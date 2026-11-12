import "server-only"

import { notFound } from "next/navigation"

import type { Lesson, Person, Task, Unit, Uuid } from "@/lib/domain/types"
import { today } from "@/server/mock/clock"
import { childrenOf, currentUnitsOfPerson, personOf, sameUnit } from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName, bySessionTime, personRef, unitOf, unitRef } from "./present"

export type PublishedLesson = {
  id: Uuid
  title: string
  summary: string | null
  objectives: string | null
  teachingPoints: string | null
  materials: { label: string; url: string | null }[]
  date: string
  unit: ReturnType<typeof unitRef>
}

export function publishedLesson(s: State, l: Lesson): PublishedLesson {
  return {
    id: l.id,
    title: l.title,
    summary: l.summary,
    objectives: l.objectives,
    teachingPoints: l.teachingPoints,
    materials: l.materials.filter((m) => m.shared).map((m) => ({ label: m.label, url: m.url })),
    date: l.date,
    unit: unitRef(s, unitOf(l)),
  }
}

function inUnits(units: Unit[], x: { serviceId: Uuid; stageId: Uuid | null }) {
  return units.some((u) => sameUnit(u, unitOf(x)))
}

function taskView(s: State, t: Task, personId: Uuid) {
  const done = s.completions.find(
    (c) => c.taskId === t.id && c.personId === personId && c.undoneAt === null
  )
  const by = done?.completedBy ? s.accounts.find((a) => a.id === done.completedBy) : undefined

  return {
    id: t.id,
    title: t.title,
    instructions: t.instructions,
    dueDate: t.dueDate,
    resources: t.resources,
    lessonId: t.lessonId,
    lessonTitle: s.lessons.find((l) => l.id === t.lessonId)?.title ?? "",
    unit: unitRef(s, unitOf(t)),
    doneAt: done?.completedAt ?? null,
    doneBy: by ? accountName(s, by) : null,
  }
}

function learningFor(s: State, person: Person) {
  const units = currentUnitsOfPerson(s, person.id, today())
  const lessons = s.lessons
    .filter((l) => l.status === "published" && inUnits(units, l))
    .sort((a, b) => b.date.localeCompare(a.date))
  const tasks = s.tasks
    .filter((t) => t.status === "published" && inUnits(units, t))
    .map((t) => taskView(s, t, person.id))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))

  return {
    units: units.map((u) => unitRef(s, u)),
    lessons: lessons.map((l) => ({
      ...publishedLesson(s, l),
      tasks: tasks.filter((t) => t.lessonId === l.id).length,
    })),
    open: tasks.filter((t) => !t.doneAt),
    done: tasks.filter((t) => t.doneAt).slice(0, 5),
  }
}

function lessonFor(s: State, person: Person, lessonId: Uuid) {
  const units = currentUnitsOfPerson(s, person.id, today())
  const lesson = s.lessons.find((l) => l.id === lessonId)

  if (!lesson || lesson.status !== "published" || !inUnits(units, lesson)) {
    notFound()
  }

  return {
    lesson: publishedLesson(s, lesson),
    tasks: s.tasks
      .filter((t) => t.lessonId === lesson.id && t.status === "published")
      .map((t) => taskView(s, t, person.id)),
  }
}

function taskFor(s: State, person: Person, taskId: Uuid) {
  const units = currentUnitsOfPerson(s, person.id, today())
  const task = s.tasks.find((t) => t.id === taskId)

  if (!task || task.status !== "published" || !inUnits(units, task)) {
    notFound()
  }

  const lesson = s.lessons.find((l) => l.id === task.lessonId)

  return {
    task: taskView(s, task, person.id),
    lesson: lesson?.status === "published" ? { id: lesson.id, title: lesson.title } : null,
  }
}

export function childrenFor({ state: s, viewer }: Context) {
  return childrenOf(s, viewer.id)
    .map((c) => ({
      ...personRef(c),
      firstName: c.firstName,
      groups: currentUnitsOfPerson(s, c.id, today()).map((u) => unitRef(s, u).name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

function childFor(ctx: Context, childId: Uuid | null): Person | null {
  const children = childrenOf(ctx.state, ctx.viewer.id)

  if (childId === null) {
    return children[0] ?? null
  }

  const child = children.find((c) => c.id === childId)

  if (!child) {
    notFound()
  }

  return child
}

export function getParentHome(ctx: Context, childId: Uuid | null) {
  const child = childFor(ctx, childId)

  return {
    children: childrenFor(ctx),
    child: child ? { ...personRef(child), firstName: child.firstName } : null,
    ...(child ? learningFor(ctx.state, child) : { units: [], lessons: [], open: [], done: [] }),
  }
}

export function getParentLesson(ctx: Context, lessonId: Uuid, childId: Uuid | null) {
  const child = childFor(ctx, childId)

  if (!child) {
    notFound()
  }

  return {
    child: { ...personRef(child), firstName: child.firstName },
    ...lessonFor(ctx.state, child, lessonId),
  }
}

export function getParentTask(ctx: Context, taskId: Uuid, childId: Uuid | null) {
  const child = childFor(ctx, childId)

  if (!child) {
    notFound()
  }

  return {
    child: { ...personRef(child), firstName: child.firstName },
    ...taskFor(ctx.state, child, taskId),
  }
}

function self(ctx: Context): Person {
  return personOf(ctx.state, ctx.viewer.personId)!
}

export function getMemberHome(ctx: Context) {
  const { state: s } = ctx
  const person = self(ctx)
  const learning = learningFor(s, person)
  const units = currentUnitsOfPerson(s, person.id, today())

  return {
    firstName: person.firstName,
    ...learning,
    sessions: s.sessions
      .filter((x) => inUnits(units, x) && x.date >= today() && x.status !== "closed")
      .sort(bySessionTime)
      .slice(0, 4)
      .map((x) => ({
        id: x.id,
        unit: unitRef(s, unitOf(x)),
        date: x.date,
        startTime: x.startTime,
        endTime: x.endTime,
        location: x.location,
        canceled: x.status === "canceled",
        oneOff: x.kind === "oneOff",
      })),
  }
}

export function getMemberLesson(ctx: Context, lessonId: Uuid) {
  return lessonFor(ctx.state, self(ctx), lessonId)
}

export function getMemberTask(ctx: Context, taskId: Uuid) {
  return { ...taskFor(ctx.state, self(ctx), taskId), personId: self(ctx).id }
}
