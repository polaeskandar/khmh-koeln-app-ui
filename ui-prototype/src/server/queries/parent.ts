import "server-only"

import { isGuardianOf } from "@/lib/domain/policy"
import { daysBetween, localDateOf } from "@/lib/domain/time"
import type { LocalDate, Person, Uuid } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import {
  childrenOf,
  currentCompletion,
  currentStagesOf,
  homeworkAudience,
  homeworkOf,
  lessonOf,
  personOf,
  serviceOf,
  stageOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

/**
 * Read models for the parent portal. Data minimisation: only the viewer's own
 * approved children, only published homework, and only what parents need
 * (title, instructions, passage, memory verse, resources). Servant notes,
 * lesson plans, other children and attendance are never part of these models.
 */

export type ChildSummary = {
  id: Uuid
  name: string
  fullName: string
  initials: string
  stage: string | null
  service: string | null
  toDo: number
  done: number
}

export type ParentTask = {
  id: Uuid
  childId: Uuid
  childName: string
  title: string
  instructions: string
  lessonTitle: string
  stage: string
  dueDate: LocalDate | null
  /** Days until the due date; negative once it has passed. */
  dueInDays: number | null
  done: boolean
  completedAt: string | null
  completedBy: string | null
  /** Reported by the signed-in parent (not by the other parent). */
  completedByYou: boolean
  completedLate: boolean
  publishedAt: string
}

const childName = (p: Person) => p.displayName ?? p.firstName

function tasksFor(s: State, child: Person, today: LocalDate, viewerId: Uuid): ParentTask[] {
  const stageIds = new Set(currentStagesOf(s, child.id, today).map((x) => x.stageId))
  return s.homework
    .filter((h) => h.status === "published")
    .filter((h) => stageIds.has(h.stageId) || currentCompletion(s, h.id, child.id))
    .filter((h) => homeworkAudience(s, h, today).some((a) => a.person.id === child.id))
    .map((h) => {
      const lesson = lessonOf(s, h.lessonId)!
      const c = currentCompletion(s, h.id, child.id)
      return {
        id: h.id,
        childId: child.id,
        childName: childName(child),
        title: h.title,
        instructions: h.instructions,
        lessonTitle: lesson.title,
        stage: stageOf(s, h.stageId)?.name ?? "",
        dueDate: h.dueDate,
        dueInDays: h.dueDate ? daysBetween(today, h.dueDate) : null,
        done: !!c,
        completedAt: c?.completedAt ?? null,
        completedBy: c ? (userOf(s, c.completedBy)?.displayName ?? null) : null,
        completedByYou: c?.completedBy === viewerId,
        completedLate: !!(c && h.dueDate && localDateOf(c.completedAt) > h.dueDate),
        publishedAt: h.publishedAt!,
      }
    })
}

/** Open tasks first, soonest due date first; then the rest by publication. */
function sortTasks(tasks: ParentTask[]) {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      b.publishedAt.localeCompare(a.publishedAt)
  )
}

function summary(s: State, child: Person, today: LocalDate, viewerId: Uuid): ChildSummary {
  const placement = currentStagesOf(s, child.id, today)[0]
  const tasks = tasksFor(s, child, today, viewerId)
  return {
    id: child.id,
    name: childName(child),
    fullName: `${child.firstName} ${child.lastName}`,
    initials: `${childName(child).charAt(0)}${child.lastName.charAt(0)}`.toUpperCase(),
    stage: placement ? (stageOf(s, placement.stageId)?.name ?? null) : null,
    service: placement ? (serviceOf(s, placement.serviceId)?.name ?? null) : null,
    toDo: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
  }
}

export async function getParentHome(ctx: Context, childId?: string) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const children = childrenOf(s, viewer.id)
  const selected = children.find((c) => c.id === childId) ?? children[0]
  const tasks = selected ? sortTasks(tasksFor(s, selected, today, viewer.id)) : []
  const person = personOf(s, viewer.personId)
  return {
    parentName: person?.firstName ?? viewer.displayName.split(" ")[0],
    today,
    children: children.map((c) => summary(s, c, today, viewer.id)),
    selected: selected ? summary(s, selected, today, viewer.id) : null,
    toDo: tasks.filter((t) => !t.done),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 5),
    pendingAccess: s.guardians.some((g) => g.userId === viewer.id && g.status === "pending"),
  }
}

export async function getParentChildren(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  return {
    today,
    children: childrenOf(s, viewer.id).map((c) => summary(s, c, today, viewer.id)),
    pendingAccess: s.guardians.filter((g) => g.userId === viewer.id && g.status === "pending")
      .length,
  }
}

export async function getParentHomework(ctx: Context, childId?: string) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const children = childrenOf(s, viewer.id)
  const selected = children.find((c) => c.id === childId) ?? children[0]
  const tasks = selected ? sortTasks(tasksFor(s, selected, today, viewer.id)) : []
  return {
    today,
    children: children.map((c) => summary(s, c, today, viewer.id)),
    selected: selected ? summary(s, selected, today, viewer.id) : null,
    toDo: tasks.filter((t) => !t.done),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
  }
}

/**
 * One homework task for one of the viewer's children. Without a child in the
 * URL, the first of the viewer's children who has this task is used.
 */
export async function getParentHomeworkDetail(ctx: Context, homeworkId: string, childId?: string) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const hw = homeworkOf(s, homeworkId)
  // Same answer for "not your child", "not published" and "does not exist": nothing leaks about other families.
  if (!hw || hw.status !== "published") return null
  const candidates = childId
    ? [personOf(s, childId)].filter((p): p is Person => !!p)
    : childrenOf(s, viewer.id)
  for (const child of candidates) {
    if (!isGuardianOf(viewer, child.id, s.guardians)) continue
    const task = tasksFor(s, child, today, viewer.id).find((t) => t.id === hw.id)
    if (!task) continue
    const lesson = lessonOf(s, hw.lessonId)!
    return {
      today,
      child: summary(s, child, today, viewer.id),
      task,
      resources: hw.resources,
      lesson: {
        title: lesson.title,
        passage: lesson.passage,
        memoryVerse: lesson.memoryVerse,
        teachingDate: lesson.teachingDate,
      },
      siblings: childrenOf(s, viewer.id).filter((c) => c.id !== child.id).length,
    }
  }
  return null
}

export type ParentHomeworkDetail = NonNullable<Awaited<ReturnType<typeof getParentHomeworkDetail>>>

/** The parent's own account: who they are and which children they can see. */
export async function getParentAccount(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  return {
    name: viewer.displayName,
    email: viewer.email,
    children: childrenOf(s, viewer.id).map((c) => summary(s, c, today, viewer.id)),
    pending: s.guardians
      .filter((g) => g.userId === viewer.id && g.status === "pending")
      .map((g) => {
        const child = personOf(s, g.personId)
        return {
          id: g.id,
          /** Null if the child's record is gone; the page then says "a child". */
          childName: child ? childName(child) : null,
          requestedAt: g.createdAt,
        }
      }),
  }
}
