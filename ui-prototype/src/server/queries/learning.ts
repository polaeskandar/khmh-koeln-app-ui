import "server-only"

import { notFound } from "next/navigation"

import type { Account, Lesson, Person, Task, Unit, Uuid } from "@/lib/domain/types"
import { can, canOpenLesson, canSeeUnit, unitsWith } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import {
  accountOfPerson,
  guardianAccountsOf,
  rosterOf,
  sameUnit,
  scheduleFor,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName, accountRef, personRef, unitOf, unitRef } from "./present"

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

export function getPreparation(ctx: Context) {
  const { state: s, viewer } = ctx
  const date = today()

  return lessonUnits(s, viewer)
    .filter((u) => canSeeUnit(s, viewer, u))
    .map((u) => {
      const lessons = s.lessons.filter((l) => sameUnit(unitOf(l), u) && canOpenLesson(s, viewer, l))

      return {
        unit: unitRef(s, u),
        canCreate: can(s, viewer, "lessons.prepare", u),
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

function lessonUnits(s: State, viewer: Account): Unit[] {
  const units = [
    ...unitsWith(s, viewer, "lessons.manage"),
    ...unitsWith(s, viewer, "lessons.prepare"),
  ]

  return units.filter((u, i) => units.findIndex((x) => sameUnit(x, u)) === i)
}

export function lessonFor({ state: s, viewer }: Context, lessonId: Uuid): Lesson {
  const lesson = s.lessons.find((l) => l.id === lessonId)

  if (!lesson || !canOpenLesson(s, viewer, lesson)) {
    notFound()
  }

  return lesson
}

export function getLesson(ctx: Context, lessonId: Uuid) {
  const { state: s, viewer } = ctx
  const lesson = lessonFor(ctx, lessonId)
  const unit = unitOf(lesson)
  const session = s.sessions.find((x) => x.id === lesson.sessionId)

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
      publish: can(s, viewer, "lessons.publish", unit),
      tasks: can(s, viewer, "tasks.manage", unit),
    },
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

  if (!canSeeUnit(s, viewer, unit) || (!lesson && !can(s, viewer, "lessons.prepare", unit))) {
    notFound()
  }

  return {
    unit: unitRef(s, unit),
    lesson,
    sessions: sessionOptions(s, unit, lesson?.sessionId ?? null),
  }
}

export function getTasks(ctx: Context) {
  const { state: s, viewer } = ctx
  const opens = (t: Task) =>
    s.lessons.some((l) => l.id === t.lessonId && canOpenLesson(s, viewer, l))

  return unitsWith(s, viewer, "tasks.manage")
    .filter((u) => canSeeUnit(s, viewer, u))
    .map((u) => ({
      unit: unitRef(s, u),
      tasks: s.tasks
        .filter((t) => sameUnit(unitOf(t), u) && t.status !== "archived" && opens(t))
        .sort((a, b) => (b.dueDate ?? "9999").localeCompare(a.dueDate ?? "9999"))
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          lesson: s.lessons.find((l) => l.id === t.lessonId)?.title ?? "",
          ...progress(s, t),
        })),
      archived: s.tasks.filter((t) => sameUnit(unitOf(t), u) && t.status === "archived" && opens(t))
        .length,
    }))
}

export function taskFor({ state: s, viewer }: Context, taskId: Uuid): Task {
  const task = s.tasks.find((t) => t.id === taskId)

  if (
    !task ||
    !can(s, viewer, "tasks.manage", unitOf(task)) ||
    !s.lessons.some((l) => l.id === task.lessonId && canOpenLesson(s, viewer, l))
  ) {
    notFound()
  }

  return task
}

export function getTask(ctx: Context, taskId: Uuid) {
  const { state: s } = ctx
  const task = taskFor(ctx, taskId)
  const lesson = s.lessons.find((l) => l.id === task.lessonId)!
  const completions = s.completions.filter((c) => c.taskId === task.id && c.undoneAt === null)

  return {
    task,
    lesson: { id: lesson.id, title: lesson.title, date: lesson.date, status: lesson.status },
    unit: unitRef(s, unitOf(task)),
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
  const { state: s } = ctx
  const task = taskId ? taskFor(ctx, taskId) : null
  const lesson = lessonFor(ctx, task?.lessonId ?? lessonId ?? "")

  if (!can(s, ctx.viewer, "tasks.manage", unitOf(lesson))) {
    notFound()
  }

  return {
    task,
    lesson: { id: lesson.id, title: lesson.title, date: lesson.date, status: lesson.status },
    unit: unitRef(s, unitOf(lesson)),
  }
}

export function taskLessonChoices(ctx: Context) {
  const { state: s, viewer } = ctx
  const date = today()

  return unitsWith(s, viewer, "tasks.manage").map((u) => ({
    unit: unitRef(s, u),
    lessons: s.lessons
      .filter(
        (l) =>
          sameUnit(unitOf(l), u) && l.date >= date.slice(0, 8) + "01" && canOpenLesson(s, viewer, l)
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({ id: l.id, title: l.title, date: l.date })),
  }))
}
