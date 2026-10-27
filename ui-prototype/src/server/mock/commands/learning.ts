import "server-only"

import { fullName } from "@/lib/domain/names"
import { can, isAdministrator, isGuardianOf } from "@/lib/domain/policy"
import { addDays, isValidLocalDate, toInstant } from "@/lib/domain/time"
import type {
  GuardianRelationship,
  HomeworkAssignment,
  HomeworkCompletion,
  Lesson,
  LessonStatus,
  LocalDate,
  Material,
  User,
  Uuid,
} from "@/lib/domain/types"
import { msg } from "@/i18n/message"
import { forbidden, ProblemError, ruleViolation } from "@/server/errors"

import { nowMs, today } from "../clock"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { lessonMeeting } from "../lesson-meeting"
import {
  currentCompletion,
  homeworkAudience,
  homeworkOf,
  isArchived,
  lessonOf,
  personOf,
  scheduleOf,
  serviceOf,
  sessionOf,
  stageOf,
  userOf,
} from "../selectors"
import type { State } from "../state"
import { isolate } from "@/lib/bidi"

// ------------------------------------------------------------------ lessons

export type LessonInput = {
  title: string
  /** "schedule:<id>:<date>", "session:<id>" or "date:<YYYY-MM-DD>" (no meeting). */
  meeting: string
  summary?: string | null
  passage?: string | null
  objectives?: string | null
  teachingPoints?: string | null
  memoryVerse?: string | null
  activities?: string | null
  materials?: Material[]
  notes?: string | null
  responsibleId: Uuid
  collaboratorIds?: Uuid[]
}

function stageFor(s: State, stageId: Uuid) {
  const stage = found(stageOf(s, stageId), "stage")
  const service = serviceOf(s, stage.serviceId)!
  return { stage, service }
}

function validateMaterials(
  v: Violations,
  field: string,
  items: Material[] | undefined
): Material[] {
  const out: Material[] = []
  for (const [i, m] of (items ?? []).entries()) {
    const label = (m.label ?? "").trim()
    const url = (m.url ?? "").trim()
    if (label === "" && url === "") continue
    if (label.length > 120) v.add(`${field}.${i}`, msg("errors.materials.labelTooLong"))
    if (url !== "" && !/^https?:\/\/\S+$/i.test(url))
      v.add(`${field}.${i}`, msg("errors.materials.url"))
    out.push({ label: label || url, url: url || null })
  }
  if (out.length > 10) v.add(field, msg("errors.materials.tooMany"))
  return out
}

/** Can this user be responsible for or collaborate on the stage's lessons? */
function canPrepare(user: User | undefined, serviceId: Uuid, stageId: Uuid) {
  return !!user && !user.disabledAt && can(user, "MANAGE_LESSONS", serviceId, stageId)
}

function validateLesson(
  s: State,
  serviceId: Uuid,
  stageId: Uuid,
  input: LessonInput,
  exceptId?: Uuid
) {
  const v = new Violations()
  const title = v.name("title", input.title, 160, msg("errors.lessons.titleRequired"))
  const text = (field: keyof LessonInput, max = 4000) =>
    v.optionalText(field, input[field] as string | null | undefined, max)

  let scheduleId: Uuid | null = null
  let sessionId: Uuid | null = null
  let teachingDate: LocalDate | null = null
  const [kind, a, b] = (input.meeting ?? "").split(":")
  if (kind === "schedule") {
    const schedule = scheduleOf(s, a)
    if (!schedule || schedule.stageId !== stageId)
      v.add("meeting", msg("errors.lessons.chooseMeeting"))
    else if (!isValidLocalDate(b ?? "")) v.add("meeting", msg("errors.lessons.chooseDate"))
    else {
      scheduleId = schedule.id
      teachingDate = b
      const draft = { scheduleId, sessionId: null, teachingDate }
      if (lessonMeeting(s, draft).kind === "not-on-schedule") {
        v.add("meeting", msg("errors.lessons.noMeetingThatDay", { name: schedule.name }))
      }
    }
  } else if (kind === "session") {
    const session = sessionOf(s, a)
    if (!session || session.stageId !== stageId)
      v.add("meeting", msg("errors.lessons.chooseMeeting"))
    else {
      sessionId = session.id
      teachingDate = session.occurrenceDate
    }
  } else if (kind === "date" && isValidLocalDate(a ?? "")) {
    teachingDate = a
  } else {
    v.add("meeting", msg("errors.lessons.chooseWhen"))
  }
  // One lesson per meeting: a second lesson for the same date would be ambiguous for servants and parents.
  if (teachingDate && (scheduleId || sessionId)) {
    const clash = s.lessons.find(
      (l) =>
        l.id !== exceptId &&
        !l.archivedAt &&
        ((scheduleId && l.scheduleId === scheduleId && l.teachingDate === teachingDate) ||
          (sessionId && l.sessionId === sessionId))
    )
    if (clash)
      v.add("meeting", msg("errors.lessons.meetingHasLesson", { title: isolate(clash.title) }))
  }

  const responsible = userOf(s, input.responsibleId)
  if (!canPrepare(responsible, serviceId, stageId))
    v.add("responsibleId", msg("errors.lessons.chooseResponsible"))
  const collaboratorIds = [...new Set(input.collaboratorIds ?? [])].filter(
    (uid) => uid !== input.responsibleId
  )
  if (collaboratorIds.some((uid) => !canPrepare(userOf(s, uid), serviceId, stageId))) {
    v.add("collaboratorIds", msg("errors.lessons.helpersInStage"))
  }
  const data = {
    title,
    summary: text("summary", 1000),
    passage: text("passage", 200),
    objectives: text("objectives"),
    teachingPoints: text("teachingPoints"),
    memoryVerse: text("memoryVerse", 500),
    activities: text("activities"),
    notes: text("notes"),
    materials: validateMaterials(v, "materials", input.materials),
    responsibleId: input.responsibleId,
    collaboratorIds,
  }
  v.throwIfAny()
  return { ...data, scheduleId, sessionId, teachingDate: teachingDate! }
}

export function createLesson(
  s: State,
  actor: User,
  stageId: Uuid,
  input: LessonInput,
  status: "draft" | "ready" = "draft"
): Lesson {
  const { stage, service } = stageFor(s, stageId)
  authorize(
    actor,
    "MANAGE_LESSONS",
    { serviceId: service.id, stageId: stage.id },
    msg("errors.lessons.prepareStageOnly")
  )
  if (isArchived(service) || isArchived(stage)) {
    throw ruleViolation(msg("errors.lessons.stageArchived", { name: stage.name }))
  }
  const data = validateLesson(s, service.id, stage.id, input)
  const ms = nowMs()
  const lesson: Lesson = {
    id: uuidv7(ms),
    serviceId: service.id,
    stageId: stage.id,
    ...data,
    status,
    completedAt: null,
    archivedAt: null,
    createdAt: toInstant(ms),
    updatedAt: toInstant(ms),
  }
  s.lessons.push(lesson)
  return lesson
}

function lessonFor(s: State, actor: User, id: Uuid) {
  const lesson = found(lessonOf(s, id), "lesson")
  authorize(
    actor,
    "MANAGE_LESSONS",
    { serviceId: lesson.serviceId, stageId: lesson.stageId },
    msg("errors.lessons.changeStageOnly")
  )
  return lesson
}

export function updateLesson(s: State, actor: User, id: Uuid, input: LessonInput): Lesson {
  const lesson = lessonFor(s, actor, id)
  if (lesson.archivedAt) throw ruleViolation(msg("errors.lessons.archived"))
  const data = validateLesson(s, lesson.serviceId, lesson.stageId!, input, lesson.id)
  Object.assign(lesson, data, { updatedAt: toInstant(nowMs()) })
  return lesson
}

/**
 * Draft → Ready when the preparation is done; Completed only once it has been
 * taught (on or after the teaching date). Each step can be undone.
 */
export function setLessonStatus(s: State, actor: User, id: Uuid, status: LessonStatus): Lesson {
  const lesson = lessonFor(s, actor, id)
  if (lesson.archivedAt) throw ruleViolation(msg("errors.lessons.archived"))
  if (status === "completed" && lesson.teachingDate > today()) {
    throw ruleViolation(msg("errors.lessons.taughtAfterDate"))
  }
  lesson.status = status
  lesson.completedAt = status === "completed" ? toInstant(nowMs()) : null
  lesson.updatedAt = toInstant(nowMs())
  return lesson
}

/** Archives the lesson and its homework; published homework disappears from the parent portal, completions are kept. */
export function archiveLesson(s: State, actor: User, id: Uuid): Lesson {
  const lesson = lessonFor(s, actor, id)
  const at = toInstant(nowMs())
  lesson.archivedAt = at
  for (const hw of s.homework.filter((h) => h.lessonId === id && h.status !== "archived")) {
    hw.status = "archived"
    hw.archivedAt = at
  }
  return lesson
}

export function restoreLesson(s: State, actor: User, id: Uuid): Lesson {
  const lesson = lessonFor(s, actor, id)
  lesson.archivedAt = null
  return lesson
}

/** Only a draft that never reached parents can be deleted; anything else is archived. */
export function deleteLesson(s: State, actor: User, id: Uuid): Lesson {
  const lesson = lessonFor(s, actor, id)
  if (lesson.status !== "draft") throw ruleViolation(msg("errors.lessons.deleteDraftsOnly"))
  if (s.homework.some((h) => h.lessonId === id && h.publishedAt !== null)) {
    throw ruleViolation(msg("errors.lessons.homeworkPublished"))
  }
  s.homework = s.homework.filter((h) => h.lessonId !== id)
  s.lessons = s.lessons.filter((l) => l.id !== id)
  return lesson
}

// ----------------------------------------------------------------- homework

export type HomeworkInput = {
  title: string
  instructions: string
  dueDate: string | null
  resources?: Material[]
}

function validateHomework(input: HomeworkInput, lesson: Lesson, existing?: HomeworkAssignment) {
  const v = new Violations()
  const title = v.name("title", input.title, 120, msg("errors.homework.titleRequired"))
  const instructions = (input.instructions ?? "").trim()
  if (instructions === "") v.add("instructions", msg("errors.homework.instructionsRequired"))
  else if (instructions.length > 2000) {
    v.add("instructions", msg("errors.homework.instructionsTooLong"))
  }
  const dueDate = v.date("dueDate", input.dueDate, false)
  if (
    dueDate &&
    !v.has("dueDate") &&
    dueDate < lesson.teachingDate &&
    dueDate !== existing?.dueDate
  ) {
    v.add("dueDate", msg("errors.homework.dueBeforeLesson"))
  }
  const resources = validateMaterials(v, "resources", input.resources)
  v.throwIfAny()
  return { title, instructions, dueDate, resources }
}

function homeworkFor(s: State, actor: User, id: Uuid) {
  const hw = found(homeworkOf(s, id), "homework")
  authorize(
    actor,
    "MANAGE_HOMEWORK",
    { serviceId: hw.serviceId, stageId: hw.stageId },
    msg("errors.homework.changeStageOnly")
  )
  return hw
}

export function createHomework(
  s: State,
  actor: User,
  lessonId: Uuid,
  input: HomeworkInput,
  publish: boolean
): HomeworkAssignment {
  const lesson = found(lessonOf(s, lessonId), "lesson")
  if (!lesson.stageId) throw ruleViolation(msg("errors.homework.lessonWithoutStage"))
  authorize(
    actor,
    "MANAGE_HOMEWORK",
    { serviceId: lesson.serviceId, stageId: lesson.stageId },
    msg("errors.homework.assignStageOnly")
  )
  if (lesson.archivedAt) throw ruleViolation(msg("errors.lessons.archived"))
  const data = validateHomework(input, lesson)
  const ms = nowMs()
  const hw: HomeworkAssignment = {
    id: uuidv7(ms),
    lessonId: lesson.id,
    serviceId: lesson.serviceId,
    stageId: lesson.stageId,
    ...data,
    status: publish ? "published" : "draft",
    publishedAt: publish ? toInstant(ms) : null,
    archivedAt: null,
    createdBy: actor.id,
    createdAt: toInstant(ms),
    updatedAt: toInstant(ms),
  }
  s.homework.push(hw)
  return hw
}

/** Editing published homework changes what parents read straight away; reported completions stay. */
export function updateHomework(
  s: State,
  actor: User,
  id: Uuid,
  input: HomeworkInput
): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  if (hw.status === "archived") throw ruleViolation(msg("errors.homework.archivedNoEdit"))
  const lesson = lessonOf(s, hw.lessonId)!
  Object.assign(hw, validateHomework(input, lesson, hw), { updatedAt: toInstant(nowMs()) })
  return hw
}

export function publishHomework(s: State, actor: User, id: Uuid): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  if (hw.status === "published") return hw
  if (hw.status === "archived") throw ruleViolation(msg("errors.homework.archivedNoPublish"))
  const lesson = lessonOf(s, hw.lessonId)!
  if (lesson.archivedAt) throw ruleViolation(msg("errors.homework.lessonArchived"))
  const ms = nowMs()
  hw.status = "published"
  hw.publishedAt = toInstant(ms)
  hw.updatedAt = toInstant(ms)
  return hw
}

/** Back to draft, while no parent has reported it done. Afterwards it can only be archived. */
export function unpublishHomework(s: State, actor: User, id: Uuid): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  if (hw.status !== "published") throw ruleViolation(msg("errors.homework.onlyPublishedBack"))
  if (s.completions.some((c) => c.assignmentId === id && c.undoneAt === null)) {
    throw ruleViolation(msg("errors.homework.alreadyReported"))
  }
  hw.status = "draft"
  hw.updatedAt = toInstant(nowMs())
  return hw
}

export function archiveHomework(s: State, actor: User, id: Uuid): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  const ms = nowMs()
  hw.status = "archived"
  hw.archivedAt = toInstant(ms)
  hw.updatedAt = toInstant(ms)
  return hw
}

/**
 * Takes archived homework back: published again if parents had it before
 * (their reported completions are still there), otherwise a draft.
 */
export function restoreHomework(s: State, actor: User, id: Uuid): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  if (hw.status !== "archived") throw ruleViolation(msg("errors.homework.notArchived"))
  const lesson = lessonOf(s, hw.lessonId)!
  if (lesson.archivedAt) throw ruleViolation(msg("errors.homework.lessonArchived"))
  hw.status = hw.publishedAt ? "published" : "draft"
  hw.archivedAt = null
  hw.updatedAt = toInstant(nowMs())
  return hw
}

export function deleteHomework(s: State, actor: User, id: Uuid): HomeworkAssignment {
  const hw = homeworkFor(s, actor, id)
  if (hw.publishedAt !== null) throw ruleViolation(msg("errors.homework.publishedStays"))
  s.homework = s.homework.filter((h) => h.id !== id)
  return hw
}

// ------------------------------------------------------- parent completion

function parentAccess(s: State, actor: User, assignmentId: Uuid, personId: Uuid) {
  const person = found(personOf(s, personId), "person")
  if (!isGuardianOf(actor, person.id, s.guardians)) {
    throw forbidden(msg("errors.homework.ownChildrenOnly"))
  }
  const hw = found(homeworkOf(s, assignmentId), "homework")
  if (hw.status !== "published")
    throw new ProblemError({ status: 404, detail: msg("errors.homework.notAvailable") })
  const audience = homeworkAudience(s, hw, today())
  if (!audience.some((a) => a.person.id === person.id)) {
    throw forbidden(
      msg("errors.homework.otherClass", { name: person.displayName ?? person.firstName })
    )
  }
  return { hw, person }
}

/** Idempotent: completing twice keeps the first report, so double taps and retries are safe. */
export function completeHomework(
  s: State,
  actor: User,
  assignmentId: Uuid,
  personId: Uuid
): HomeworkCompletion {
  const { hw, person } = parentAccess(s, actor, assignmentId, personId)
  const existing = currentCompletion(s, hw.id, person.id)
  if (existing) return existing
  const ms = nowMs()
  const completion: HomeworkCompletion = {
    id: uuidv7(ms),
    assignmentId: hw.id,
    personId: person.id,
    completedAt: toInstant(ms),
    completedBy: actor.id,
    undoneAt: null,
    undoneBy: null,
  }
  s.completions.push(completion)
  return completion
}

/** Undo keeps the row (who undid it and when), so the history of reports stays readable. */
export function undoCompletion(
  s: State,
  actor: User,
  assignmentId: Uuid,
  personId: Uuid
): HomeworkCompletion | null {
  const { hw, person } = parentAccess(s, actor, assignmentId, personId)
  const existing = currentCompletion(s, hw.id, person.id)
  if (!existing) return null
  existing.undoneAt = toInstant(nowMs())
  existing.undoneBy = actor.id
  return existing
}

// -------------------------------------------------------- guardian links

/** Only administrators link parent accounts to children; knowing a child's name is never enough. */
export function linkGuardian(
  s: State,
  actor: User,
  userId: Uuid,
  personId: Uuid
): GuardianRelationship {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.guardians.adminOnlyGrant"))
  const parent = found(userOf(s, userId), "user")
  const child = found(personOf(s, personId), "person")
  const existing = s.guardians.find(
    (g) => g.userId === parent.id && g.personId === child.id && g.status !== "revoked"
  )
  if (existing?.status === "approved") {
    throw ruleViolation(
      msg("errors.guardians.alreadyHasAccess", {
        parent: parent.displayName,
        child: fullName(child),
      })
    )
  }
  const ms = nowMs()
  if (existing) {
    existing.status = "approved"
    existing.approvedBy = actor.id
    existing.approvedAt = toInstant(ms)
    return existing
  }
  if (!parent.roles.some((r) => r.role === "parent"))
    parent.roles.push({ role: "parent", serviceId: null, stageId: null })
  const link: GuardianRelationship = {
    id: uuidv7(ms),
    userId: parent.id,
    personId: child.id,
    relationship: "parent",
    status: "approved",
    approvedBy: actor.id,
    approvedAt: toInstant(ms),
    createdAt: toInstant(ms),
  }
  s.guardians.push(link)
  return link
}

export function approveGuardian(s: State, actor: User, id: Uuid): GuardianRelationship {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.guardians.adminOnlyApprove"))
  const link = found(
    s.guardians.find((g) => g.id === id),
    "guardian"
  )
  if (link.status === "approved") return link
  link.status = "approved"
  link.approvedBy = actor.id
  link.approvedAt = toInstant(nowMs())
  return link
}

export function revokeGuardian(s: State, actor: User, id: Uuid): GuardianRelationship {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.guardians.adminOnlyRemove"))
  const link = found(
    s.guardians.find((g) => g.id === id),
    "guardian"
  )
  link.status = "revoked"
  return link
}

/** Days until a due date, for gentle wording ("due in 3 days"). */
export function dueIn(dueDate: LocalDate | null): number | null {
  if (!dueDate) return null
  let n = 0
  for (let d = today(); d < dueDate && n < 400; d = addDays(d, 1)) n++
  return dueDate < today() ? -1 : n
}
