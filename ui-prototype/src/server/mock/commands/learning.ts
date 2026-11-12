import { msg } from "@/i18n/message"
import type {
  Lesson,
  LessonStatus,
  LocalDate,
  Material,
  Resource,
  Task,
  Unit,
  Uuid,
} from "@/lib/domain/types"
import { forbidden, ruleViolation } from "@/server/errors"

import { can, canOpenLesson, requireIn } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { currentUnitsOfPerson, sameUnit, sessionOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"
import { isGuardian } from "./guardians"

export type LessonInput = {
  sessionId: Uuid | null
  date: LocalDate | null
  title: string
  summary: string | null
  objectives: string | null
  teachingPoints: string | null
  materials: Material[]
  notes: string | null
}

const unitOf = (x: { serviceId: Uuid; stageId: Uuid | null }): Unit => ({
  serviceId: x.serviceId,
  stageId: x.stageId,
})

function checkLinks(v: Violations, field: string, links: { label: string; url: string | null }[]) {
  links.forEach((link, index) => {
    if (link.label.trim() === "") {
      v.add(`${field}.${index}`, msg("errors.learning.labelRequired"))
    } else if (link.url && !/^https?:\/\/\S+$/.test(link.url.trim())) {
      v.add(`${field}.${index}`, msg("errors.learning.invalidUrl"))
    }
  })
}

function cleanLesson(s: State, unit: Unit, input: LessonInput) {
  const v = new Violations()
  const title = v.name("title", input.title, 160, msg("errors.learning.titleRequired"))
  const summary = v.optionalText("summary", input.summary, 2000)
  const objectives = v.optionalText("objectives", input.objectives, 4000)
  const teachingPoints = v.optionalText("teachingPoints", input.teachingPoints, 8000)
  const notes = v.optionalText("notes", input.notes, 4000)
  checkLinks(v, "materials", input.materials)
  let date = input.date

  if (input.sessionId) {
    const session = sessionOf(s, input.sessionId)

    if (!session || !sameUnit(unitOf(session), unit)) {
      v.add("sessionId", msg("errors.learning.sessionOfOtherGroup"))
    } else {
      date = session.date
    }
  }

  if (!date) {
    v.add("sessionId", msg("errors.learning.chooseDate"))
  } else {
    v.date("sessionId", date)
  }

  v.throwIfAny()

  return {
    title,
    summary,
    objectives,
    teachingPoints,
    notes,
    sessionId: input.sessionId,
    date: date!,
    materials: input.materials.map((m) => ({
      label: m.label.trim(),
      url: m.url?.trim() || null,
      shared: m.shared,
    })),
  }
}

export function createLesson(actor: Actor, unit: Unit, input: LessonInput) {
  requireIn(actor.state, actor.viewer, "lessons.prepare", unit, "stage")
  const clean = cleanLesson(actor.state, unit, input)
  const lesson: Lesson = {
    id: uuidv7(nowMs()),
    ...unit,
    ...clean,
    status: "draft",
    responsibleId: actor.viewer.id,
    publishedAt: null,
    createdAt: now(),
    updatedAt: now(),
  }
  actor.state.lessons.push(lesson)

  return lesson
}

function lessonFor({ state: s, viewer }: Actor, lessonId: Uuid) {
  return found(
    s.lessons.find((l) => l.id === lessonId && canOpenLesson(s, viewer, l)),
    "lesson"
  )
}

export function updateLesson(actor: Actor, lessonId: Uuid, input: LessonInput) {
  const lesson = lessonFor(actor, lessonId)
  Object.assign(lesson, cleanLesson(actor.state, unitOf(lesson), input), { updatedAt: now() })

  return lesson
}

export function setLessonStatus(actor: Actor, lessonId: Uuid, status: LessonStatus) {
  const lesson = lessonFor(actor, lessonId)

  if (status === "published" || lesson.status === "published") {
    requireIn(actor.state, actor.viewer, "lessons.publish", unitOf(lesson), "lesson")
  }

  if (status === "published" && !lesson.summary) {
    throw ruleViolation(msg("errors.learning.summaryBeforePublishing"))
  }

  lesson.status = status
  lesson.publishedAt = status === "published" ? now() : null
  lesson.updatedAt = now()
}

export function deleteLesson(actor: Actor, lessonId: Uuid) {
  const lesson = lessonFor(actor, lessonId)

  if (lesson.status === "published") {
    throw ruleViolation(msg("errors.learning.publishedLesson"))
  }

  if (actor.state.tasks.some((t) => t.lessonId === lesson.id)) {
    throw ruleViolation(msg("errors.learning.lessonHasTasks"))
  }

  actor.state.lessons.splice(actor.state.lessons.indexOf(lesson), 1)
}

export type TaskInput = {
  title: string
  instructions: string
  dueDate: LocalDate | null
  resources: Resource[]
}

function cleanTask(input: TaskInput) {
  const v = new Violations()
  const title = v.name("title", input.title, 160, msg("errors.learning.titleRequired"))
  const instructions = v.optionalText("instructions", input.instructions, 4000)

  if (!instructions) {
    v.add("instructions", msg("errors.learning.instructionsRequired"))
  }

  const dueDate = v.date("dueDate", input.dueDate, false)
  checkLinks(v, "resources", input.resources)
  v.throwIfAny()

  return {
    title,
    instructions: instructions!,
    dueDate,
    resources: input.resources.map((r) => ({ label: r.label.trim(), url: r.url?.trim() || null })),
  }
}

export function createTask(actor: Actor, lessonId: Uuid, input: TaskInput, publish: boolean) {
  const lesson = lessonFor(actor, lessonId)
  requireIn(actor.state, actor.viewer, "tasks.manage", unitOf(lesson), "lesson")
  const task: Task = {
    id: uuidv7(nowMs()),
    lessonId: lesson.id,
    ...unitOf(lesson),
    ...cleanTask(input),
    status: publish ? "published" : "draft",
    publishedAt: publish ? now() : null,
    createdBy: actor.viewer.id,
    createdAt: now(),
    updatedAt: now(),
  }
  actor.state.tasks.push(task)

  return task
}

function taskFor(actor: Actor, taskId: Uuid) {
  const task = found(
    actor.state.tasks.find(
      (t) =>
        t.id === taskId &&
        actor.state.lessons.some(
          (l) => l.id === t.lessonId && canOpenLesson(actor.state, actor.viewer, l)
        )
    ),
    "task"
  )
  requireIn(actor.state, actor.viewer, "tasks.manage", unitOf(task), "task")

  return task
}

export function updateTask(actor: Actor, taskId: Uuid, input: TaskInput) {
  const task = taskFor(actor, taskId)
  Object.assign(task, cleanTask(input), { updatedAt: now() })

  return task
}

export function setTaskStatus(actor: Actor, taskId: Uuid, status: Task["status"]) {
  const task = taskFor(actor, taskId)
  const reported = actor.state.completions.some((c) => c.taskId === task.id && c.undoneAt === null)

  if (status === "draft" && reported) {
    throw ruleViolation(msg("errors.learning.taskHasReports"))
  }

  task.status = status
  task.publishedAt = status === "published" ? (task.publishedAt ?? now()) : task.publishedAt
  task.updatedAt = now()
}

export function deleteTask(actor: Actor, taskId: Uuid) {
  const task = taskFor(actor, taskId)

  if (task.status !== "draft") {
    throw ruleViolation(msg("errors.learning.onlyDraftsDeleted"))
  }

  actor.state.tasks.splice(actor.state.tasks.indexOf(task), 1)
}

export function setTaskDone(
  { state: s, viewer }: Actor,
  taskId: Uuid,
  personId: Uuid,
  done: boolean
) {
  const task = found(
    s.tasks.find((t) => t.id === taskId),
    "task"
  )
  const forSelf = viewer.personId === personId && can(s, viewer, "portal.member")
  const forChild = can(s, viewer, "portal.parent") && isGuardian(s, viewer.id, personId)
  const inGroup = currentUnitsOfPerson(s, personId, today()).some((unit) =>
    sameUnit(unit, unitOf(task))
  )

  if (!(forSelf || forChild) || !inGroup || task.status !== "published") {
    throw forbidden()
  }

  const current = s.completions.find(
    (c) => c.taskId === task.id && c.personId === personId && c.undoneAt === null
  )

  if (done && !current) {
    s.completions.push({
      id: uuidv7(nowMs()),
      taskId: task.id,
      personId,
      completedAt: now(),
      completedBy: viewer.id,
      undoneAt: null,
    })
  }

  if (!done && current) {
    current.undoneAt = now()
  }
}
