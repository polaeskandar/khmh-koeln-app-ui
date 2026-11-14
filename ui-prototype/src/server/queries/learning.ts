import "server-only"

import { notFound } from "next/navigation"

import type {
  Account,
  Lesson,
  Permission,
  Person,
  ResourceRef,
  Task,
  Unit,
  Uuid,
} from "@/lib/domain/types"
import { can, canSeeUnit, unitsWith } from "@/server/mock/access"
import { managesAt } from "@/server/mock/delegation"
import { today } from "@/server/mock/clock"
import {
  accountOfPerson,
  guardianAccountsOf,
  rosterOf,
  sameUnit,
  scheduleFor,
  unitsOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName, accountRef, personRef, unitOf, unitRef } from "./present"
import { accessHref } from "./access"

export function reachable(s: State, unit: Unit): { person: Person; via: "own" | "parent" }[] {
  return rosterOf(s, unit, today()).flatMap(
    (person): { person: Person; via: "own" | "parent" }[] => {
      const own = accountOfPerson(s, person.id)

      if (own && can(s, own, "portal.member")) {
        return [{ person, via: "own" as const }]
      }

      return guardianAccountsOf(s, person.id).length > 0 ? [{ person, via: "parent" as const }] : []
    }
  )
}

export function progress(s: State, task: Task) {
  const people = reachable(s, unitOf(task))
  const done = new Set(
    s.completions.filter((c) => c.taskId === task.id && c.undoneAt === null).map((c) => c.personId)
  )

  return { done: people.filter((p) => done.has(p.person.id)).length, total: people.length }
}

function lessonSummary(s: State, l: Lesson) {
  return {
    id: l.id,
    title: l.title,
    date: l.date,
    status: l.status,
    responsible: accountRef(s, l.responsibleId),
    tasks: s.tasks.filter((t) => t.lessonId === l.id && t.status !== "archived").length,
  }
}

const lessonRef = (id: Uuid): ResourceRef => ({ type: "lesson", id })

const canLesson = (s: State, viewer: Account, permission: Permission, l: Lesson) =>
  can(s, viewer, permission, lessonRef(l.id))

function unitsOfLessons(s: State, viewer: Account, lessons: Lesson[], permission: Permission) {
  const units = [...unitsWith(s, viewer, permission), ...lessons.map(unitOf)]

  return s.services
    .flatMap((service) => unitsOf(s, service))
    .filter((u) => units.some((x) => sameUnit(x, u)))
}

export function getPreparation(ctx: Context) {
  const { state: s, viewer } = ctx
  const date = today()
  const visible = s.lessons.filter((l) => canLesson(s, viewer, "lesson.read", l))
  const units = [
    ...unitsOfLessons(s, viewer, visible, "lesson.read"),
    ...unitsWith(s, viewer, "lesson.create"),
  ]

  return units
    .filter((u, i) => units.findIndex((x) => sameUnit(x, u)) === i)
    .map((u) => {
      const lessons = visible.filter((l) => sameUnit(unitOf(l), u))

      return {
        unit: unitRef(s, u),
        canCreate: can(s, viewer, "lesson.create", u),
        upcoming: lessons
          .filter((l) => l.date >= date)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((l) => lessonSummary(s, l)),
        earlier: lessons
          .filter((l) => l.date < date)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3)
          .map((l) => lessonSummary(s, l)),
      }
    })
}

export function lessonFor({ state: s, viewer }: Context, lessonId: Uuid): Lesson {
  const lesson = s.lessons.find((l) => l.id === lessonId)

  if (!lesson || !canLesson(s, viewer, "lesson.read", lesson)) {
    notFound()
  }

  return lesson
}

export function getLesson(ctx: Context, lessonId: Uuid) {
  const { state: s, viewer } = ctx
  const lesson = lessonFor(ctx, lessonId)
  const unit = unitOf(lesson)
  const session = s.sessions.find((x) => x.id === lesson.sessionId)
  const edit = canLesson(s, viewer, "lesson.update", lesson)
  const ref = lessonRef(lesson.id)

  return {
    lesson,
    unit: unitRef(s, unit),
    responsible: accountRef(s, lesson.responsibleId),
    session: session
      ? { id: session.id, startTime: session.startTime, status: session.status }
      : null,
    tasks: s.tasks
      .filter((t) => t.lessonId === lesson.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        ...progress(s, t),
      })),
    can: {
      edit,
      publish: canLesson(s, viewer, "lesson.publish", lesson),
      delete: canLesson(s, viewer, "lesson.delete", lesson),
      tasks: canLesson(s, viewer, "task.create", lesson),
      responsible: edit,
    },
    accessHref: managesAt(s, viewer, ref) ? accessHref(ref) : null,
    responsibleChoices: edit
      ? s.accounts
          .filter((a) => canLesson(s, a, "lesson.update", lesson))
          .map((a) => ({ id: a.id, name: accountName(s, a), username: a.username }))
          .sort((a, b) => a.name.localeCompare(b.name, "de"))
      : [],
  }
}

export function sessionOptions(s: State, unit: Unit, keep: Uuid | null) {
  const schedule = scheduleFor(s, unit)
  const date = today()

  return s.sessions
    .filter(
      (x) =>
        x.scheduleId === schedule?.id &&
        ((x.date >= date && x.status !== "canceled") || x.id === keep)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 16)
    .map((x) => ({ id: x.id, date: x.date, startTime: x.startTime }))
}

export function getLessonEditor(ctx: Context, unit: Unit, lessonId: Uuid | null) {
  const { state: s, viewer } = ctx
  const lesson = lessonId ? lessonFor(ctx, lessonId) : null
  const allowed = lesson
    ? canLesson(s, viewer, "lesson.update", lesson)
    : canSeeUnit(s, viewer, unit) && can(s, viewer, "lesson.create", unit)

  if (!allowed) {
    notFound()
  }

  return {
    unit: unitRef(s, unit),
    lesson,
    sessions: sessionOptions(s, unit, lesson?.sessionId ?? null),
  }
}

const canTask = (s: State, viewer: Account, t: Task) =>
  can(s, viewer, "task.read", { type: "task", id: t.id })

export function getTasks(ctx: Context) {
  const { state: s, viewer } = ctx
  const managed = s.tasks.filter((t) => canTask(s, viewer, t))
  const lessons = s.lessons.filter((l) => managed.some((t) => t.lessonId === l.id))

  return unitsOfLessons(s, viewer, lessons, "task.read").map((u) => ({
    unit: unitRef(s, u),
    tasks: managed
      .filter((t) => sameUnit(unitOf(t), u) && t.status !== "archived")
      .sort((a, b) => (b.dueDate ?? "9999").localeCompare(a.dueDate ?? "9999"))
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        lesson: s.lessons.find((l) => l.id === t.lessonId)?.title ?? "",
        ...progress(s, t),
      })),
    archived: managed.filter((t) => sameUnit(unitOf(t), u) && t.status === "archived").length,
  }))
}

export function taskFor({ state: s, viewer }: Context, taskId: Uuid): Task {
  const task = s.tasks.find((t) => t.id === taskId)

  if (!task || !canTask(s, viewer, task)) {
    notFound()
  }

  return task
}

/** A task's lesson; whoever only has a role for the task sees its title without a link. */
function lessonOfTask(s: State, viewer: Account, task: Task) {
  const lesson = s.lessons.find((l) => l.id === task.lessonId)!

  return {
    id: lesson.id,
    title: lesson.title,
    date: lesson.date,
    status: lesson.status,
    canView: canLesson(s, viewer, "lesson.read", lesson),
  }
}

export function getTask(ctx: Context, taskId: Uuid) {
  const { state: s } = ctx
  const task = taskFor(ctx, taskId)
  const completions = s.completions.filter((c) => c.taskId === task.id && c.undoneAt === null)

  return {
    task,
    lesson: lessonOfTask(s, ctx.viewer, task),
    unit: unitRef(s, unitOf(task)),
    can: {
      update: can(s, ctx.viewer, "task.update", { type: "task", id: task.id }),
      delete: can(s, ctx.viewer, "task.delete", { type: "task", id: task.id }),
    },
    ...progress(s, task),
    people: reachable(s, unitOf(task))
      .map(({ person, via }) => {
        const done = completions.find((c) => c.personId === person.id)
        const by = done?.completedBy ? s.accounts.find((a) => a.id === done.completedBy) : undefined

        return {
          person: personRef(person),
          via,
          doneAt: done?.completedAt ?? null,
          doneBy: by ? accountName(s, by) : null,
          byOwnAccount: by?.personId === person.id,
        }
      })
      .sort((a, b) => a.person.name.localeCompare(b.person.name, "de")),
  }
}

export function getTaskEditor(ctx: Context, lessonId: Uuid | null, taskId: Uuid | null) {
  const { state: s, viewer } = ctx

  if (taskId) {
    const task = taskFor(ctx, taskId)

    if (!can(s, viewer, "task.update", { type: "task", id: task.id })) {
      notFound()
    }

    return { task, lesson: lessonOfTask(s, viewer, task), unit: unitRef(s, unitOf(task)) }
  }

  const lesson = lessonFor(ctx, lessonId ?? "")

  if (!canLesson(s, viewer, "task.create", lesson)) {
    notFound()
  }

  return {
    task: null,
    lesson: {
      id: lesson.id,
      title: lesson.title,
      date: lesson.date,
      status: lesson.status,
      canView: true,
    },
    unit: unitRef(s, unitOf(lesson)),
  }
}

export function taskLessonChoices(ctx: Context) {
  const { state: s, viewer } = ctx
  const date = today()
  const lessons = s.lessons.filter(
    (l) => l.date >= date.slice(0, 8) + "01" && canLesson(s, viewer, "task.create", l)
  )

  return unitsOfLessons(s, viewer, lessons, "task.create").map((u) => ({
    unit: unitRef(s, u),
    lessons: lessons
      .filter((l) => sameUnit(unitOf(l), u))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({ id: l.id, title: l.title, date: l.date })),
  }))
}
