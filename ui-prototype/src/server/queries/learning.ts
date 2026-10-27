import "server-only"

import { can } from "@/lib/domain/policy"
import { addDays, localDateOf, localTimeOf } from "@/lib/domain/time"
import type { HomeworkAssignment, Lesson, LocalDate, Uuid } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import { lessonMeeting, meetingOptions } from "@/server/mock/lesson-meeting"
import {
  currentCompletion,
  guardiansOf,
  homeworkAudience,
  homeworkOf,
  isArchived,
  lessonOf,
  rosterOn,
  scheduleOf,
  serviceOf,
  stageOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context, Translator } from "@/server/viewer"

import { personRef, serviceRef, stageRef, userRef } from "./present"

// ------------------------------------------------------------- view models

export type MeetingView =
  | { kind: "none"; date: LocalDate }
  | { kind: "planned"; date: LocalDate; startTime: string; title: string; createdOn: LocalDate }
  | {
      kind: "session"
      id: Uuid
      status: "scheduled" | "active" | "completed" | "canceled"
      date: LocalDate
      startTime: string
      endTime: string | null
      title: string
      location: string | null
      moved: boolean
      cancelReason: string | null
    }
  | { kind: "not-on-schedule"; date: LocalDate; title: string | null }

function meetingView(s: State, lesson: Lesson): MeetingView {
  const m = lessonMeeting(s, lesson)
  switch (m.kind) {
    case "none":
      return { kind: "none", date: lesson.teachingDate }
    case "planned": {
      const schedule = scheduleOf(s, m.scheduleId)!
      return {
        kind: "planned",
        date: m.date,
        startTime: schedule.startTime,
        title: schedule.name,
        createdOn: m.createdOn,
      }
    }
    case "session":
      return {
        kind: "session",
        id: m.session.id,
        status: m.session.status,
        date: localDateOf(m.session.startsAt),
        startTime: localTimeOf(m.session.startsAt),
        endTime: m.session.endsAt ? localTimeOf(m.session.endsAt) : null,
        title: m.session.title,
        location: m.session.location,
        moved: s.events.some((e) => e.sessionId === m.session.id && e.type === "moved"),
        cancelReason: m.session.cancelReason,
      }
    case "not-on-schedule":
      return {
        kind: "not-on-schedule",
        date: m.date,
        title: scheduleOf(s, m.scheduleId)?.name ?? null,
      }
  }
}

export type HomeworkCounts = {
  assigned: number
  completed: number
  notCompleted: number
  late: number
  withoutParentAccount: number
}

function homeworkCounts(s: State, hw: HomeworkAssignment, date: LocalDate): HomeworkCounts {
  const audience = homeworkAudience(s, hw, date).filter((a) => a.inStage)
  let completed = 0
  let late = 0
  let withoutParentAccount = 0
  for (const { person } of audience) {
    const c = currentCompletion(s, hw.id, person.id)
    if (c) {
      completed++
      if (hw.dueDate && localDateOf(c.completedAt) > hw.dueDate) late++
    } else if (guardiansOf(s, person.id).length === 0) withoutParentAccount++
  }
  return {
    assigned: audience.length,
    completed,
    notCompleted: audience.length - completed,
    late,
    withoutParentAccount,
  }
}

function homeworkRow(s: State, hw: HomeworkAssignment, date: LocalDate) {
  const lesson = lessonOf(s, hw.lessonId)!
  return {
    id: hw.id,
    title: hw.title,
    instructions: hw.instructions,
    status: hw.status,
    dueDate: hw.dueDate,
    publishedAt: hw.publishedAt,
    resources: hw.resources,
    lesson: { id: lesson.id, title: lesson.title, teachingDate: lesson.teachingDate },
    counts: hw.status === "draft" ? null : homeworkCounts(s, hw, date),
  }
}

export type HomeworkRow = ReturnType<typeof homeworkRow>

function lessonRow(s: State, lesson: Lesson, date: LocalDate, t: Translator) {
  const homework = s.homework.filter((h) => h.lessonId === lesson.id)
  return {
    id: lesson.id,
    title: lesson.title,
    passage: lesson.passage,
    teachingDate: lesson.teachingDate,
    status: lesson.status,
    archived: lesson.archivedAt !== null,
    // The responsible servant's account may have been erased (data protection request).
    responsible: userRef(userOf(s, lesson.responsibleId)) ?? {
      id: lesson.responsibleId,
      name: t("common.formerAccount"),
      initials: "–",
    },
    collaborators: lesson.collaboratorIds.map((id) => userRef(userOf(s, id))!).filter(Boolean),
    meeting: meetingView(s, lesson),
    homework: {
      total: homework.filter((h) => h.status !== "archived").length,
      published: homework.filter((h) => h.status === "published").length,
      drafts: homework.filter((h) => h.status === "draft").length,
    },
    updatedAt: lesson.updatedAt,
    isPast: lesson.teachingDate < date,
  }
}

export type LessonRow = ReturnType<typeof lessonRow>

function stageContext(s: State, serviceId: Uuid, stageId: Uuid) {
  const service = serviceOf(s, serviceId)
  const stage = stageOf(s, stageId)
  if (!service || !stage || stage.serviceId !== service.id) return null
  return { service: serviceRef(s, service), stage: stageRef(stage)! }
}

/** Servants who may prepare the stage's lessons: candidates for "responsible" and "helping". */
function preparers(s: State, serviceId: Uuid, stageId: Uuid) {
  return s.users
    .filter(
      (u) =>
        !u.disabledAt &&
        u.roles.some((r) => r.role !== "administrator" && r.role !== "parent") &&
        can(u, "MANAGE_LESSONS", serviceId, stageId)
    )
    .map((u) => userRef(u)!)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

// ------------------------------------------------------------------ lessons

export async function getStageLessons(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  if (!context) return null
  const today = clockToday()
  const lessons = s.lessons
    .filter((l) => l.stageId === stageId)
    .map((l) => lessonRow(s, l, today, ctx.t))
  const active = lessons.filter((l) => !l.archived)
  return {
    ...context,
    today,
    upcoming: active
      .filter((l) => l.teachingDate >= today)
      .sort((a, b) => a.teachingDate.localeCompare(b.teachingDate)),
    previous: active
      .filter((l) => l.teachingDate < today)
      .sort((a, b) => b.teachingDate.localeCompare(a.teachingDate)),
    archived: lessons.filter((l) => l.archived),
    servants: preparers(s, serviceId, stageId),
    can: {
      manage:
        can(viewer, "MANAGE_LESSONS", serviceId, stageId) && !isArchived(stageOf(s, stageId)!),
    },
  }
}

export async function getLessonDetail(
  ctx: Context,
  serviceId: Uuid,
  stageId: Uuid,
  lessonId: Uuid
) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  const lesson = lessonOf(s, lessonId)
  if (!context || !lesson || lesson.stageId !== stageId) return null
  const today = clockToday()
  return {
    ...context,
    today,
    lesson: {
      ...lessonRow(s, lesson, today, ctx.t),
      summary: lesson.summary,
      objectives: lesson.objectives,
      teachingPoints: lesson.teachingPoints,
      memoryVerse: lesson.memoryVerse,
      activities: lesson.activities,
      materials: lesson.materials,
      notes: lesson.notes,
      completedAt: lesson.completedAt,
      createdAt: lesson.createdAt,
    },
    homework: s.homework
      .filter((h) => h.lessonId === lesson.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => homeworkRow(s, h, today)),
    can: {
      manage: can(viewer, "MANAGE_LESSONS", serviceId, stageId),
      homework: can(viewer, "MANAGE_HOMEWORK", serviceId, stageId),
    },
  }
}

export async function getLessonForm(ctx: Context, serviceId: Uuid, stageId: Uuid, lessonId?: Uuid) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  if (!context) return null
  const lesson = lessonId ? lessonOf(s, lessonId) : undefined
  if (lessonId && (!lesson || lesson.stageId !== stageId)) return null
  const today = clockToday()
  const from = lesson && lesson.teachingDate < today ? lesson.teachingDate : addDays(today, -28)
  const options = meetingOptions(s, stageId, from, addDays(today, 84), lesson?.id)
  const firstFree = options.find((o) => o.date > today && !o.takenBy && o.state !== "canceled")
  return {
    ...context,
    today,
    lesson: lesson ?? null,
    meetingValue: lesson
      ? lesson.sessionId
        ? `session:${lesson.sessionId}`
        : lesson.scheduleId
          ? `schedule:${lesson.scheduleId}:${lesson.teachingDate}`
          : `date:${lesson.teachingDate}`
      : (firstFree?.value ?? `date:${today}`),
    options,
    servants: preparers(s, serviceId, stageId),
    viewerId: viewer.id,
    /** Changes whenever lessons are added or this one is saved: the form starts fresh then. */
    version: `${s.lessons.length}-${lesson?.updatedAt ?? "new"}`,
    can: { manage: can(viewer, "MANAGE_LESSONS", serviceId, stageId) },
  }
}

export type LessonForm = NonNullable<Awaited<ReturnType<typeof getLessonForm>>>

// ----------------------------------------------------------------- homework

export async function getStageHomework(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  if (!context) return null
  const today = clockToday()
  const rows = s.homework
    .filter((h) => h.stageId === stageId)
    .map((h) => homeworkRow(s, h, today))
    .sort((a, b) =>
      (b.dueDate ?? b.lesson.teachingDate).localeCompare(a.dueDate ?? a.lesson.teachingDate)
    )
  return {
    ...context,
    today,
    rows,
    lessons: s.lessons
      .filter((l) => l.stageId === stageId && !l.archivedAt)
      .sort((a, b) => b.teachingDate.localeCompare(a.teachingDate))
      .map((l) => ({ id: l.id, title: l.title, teachingDate: l.teachingDate })),
    can: {
      manage:
        can(viewer, "MANAGE_HOMEWORK", serviceId, stageId) && !isArchived(stageOf(s, stageId)!),
    },
  }
}

export async function getHomeworkEditor(
  ctx: Context,
  serviceId: Uuid,
  stageId: Uuid,
  opts: { homeworkId?: Uuid; lessonId?: Uuid }
) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  if (!context) return null
  const homework = opts.homeworkId ? homeworkOf(s, opts.homeworkId) : undefined
  if (opts.homeworkId && (!homework || homework.stageId !== stageId)) return null
  const lessons = s.lessons
    .filter((l) => l.stageId === stageId && !l.archivedAt)
    .sort((a, b) => b.teachingDate.localeCompare(a.teachingDate))
  const lesson =
    lessonOf(s, homework?.lessonId ?? opts.lessonId) ??
    lessons.find((l) => l.teachingDate >= clockToday()) ??
    lessons[0]
  const today = clockToday()
  const audience = homework ? homeworkAudience(s, homework, today) : []
  return {
    ...context,
    today,
    homework: homework ?? null,
    lesson: lesson
      ? {
          id: lesson.id,
          title: lesson.title,
          teachingDate: lesson.teachingDate,
          passage: lesson.passage,
          memoryVerse: lesson.memoryVerse,
        }
      : null,
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      teachingDate: l.teachingDate,
      passage: l.passage,
      memoryVerse: l.memoryVerse,
    })),
    childrenInStage: homework
      ? audience.filter((a) => a.inStage).length
      : rosterOn(s, serviceId, stageId, today).length,
    completions: homework
      ? s.completions.filter((c) => c.assignmentId === homework.id && c.undoneAt === null).length
      : 0,
    /** Changes whenever homework is added or this one is saved: the form starts fresh then. */
    version: `${s.homework.length}-${homework?.updatedAt ?? "new"}`,
    can: { manage: can(viewer, "MANAGE_HOMEWORK", serviceId, stageId) },
  }
}

export type HomeworkEditor = NonNullable<Awaited<ReturnType<typeof getHomeworkEditor>>>

/** S06: who reported the homework as completed. Parent-reported, not verified learning. */
export async function getHomeworkProgress(
  ctx: Context,
  serviceId: Uuid,
  stageId: Uuid,
  homeworkId: Uuid
) {
  const { state: s, viewer } = ctx
  const context = stageContext(s, serviceId, stageId)
  const hw = homeworkOf(s, homeworkId)
  if (!context || !hw || hw.stageId !== stageId) return null
  if (!can(viewer, "VIEW_HOMEWORK_PROGRESS", serviceId, stageId))
    return { ...context, forbidden: true as const }
  const today = clockToday()
  const lesson = lessonOf(s, hw.lessonId)!
  const rows = homeworkAudience(s, hw, today)
    .map(({ person, inStage }) => {
      const c = currentCompletion(s, hw.id, person.id)
      const by = c ? userOf(s, c.completedBy) : undefined
      const parents = guardiansOf(s, person.id)
      return {
        person: personRef(person),
        inStage,
        status: c ? ("completed" as const) : ("not-completed" as const),
        completedAt: c?.completedAt ?? null,
        completedBy: by ? by.displayName : null,
        late: !!(c && hw.dueDate && localDateOf(c.completedAt) > hw.dueDate),
        parentAccounts: parents.length,
      }
    })
    .sort(
      (a, b) =>
        a.person.lastName.localeCompare(b.person.lastName, "de") ||
        a.person.firstName.localeCompare(b.person.firstName, "de")
    )
  return {
    ...context,
    forbidden: false as const,
    today,
    homework: homeworkRow(s, hw, today),
    lesson: { id: lesson.id, title: lesson.title, teachingDate: lesson.teachingDate },
    rows,
    can: { manage: can(viewer, "MANAGE_HOMEWORK", serviceId, stageId) },
  }
}

export type HomeworkProgress = Extract<
  NonNullable<Awaited<ReturnType<typeof getHomeworkProgress>>>,
  { forbidden: false }
>
