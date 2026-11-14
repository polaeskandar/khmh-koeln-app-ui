import {
  CHURCH,
  childTypes,
  type ResourceRef,
  type ResourceType,
  sameRef,
} from "@/lib/domain/resources"
import type { LocalDate, LocalTime, Session, Unit, Uuid } from "@/lib/domain/types"

import { scheduleFor, scheduleOf, serviceOf, sessionOf, stageOf, stagesOf } from "./selectors"
import type { State } from "./state"

export type ResourceDetails = {
  name: string | null
  date: LocalDate | null
  time: LocalTime | null
}

/**
 * How the server reads resources of one type, for authorization and the explorer: a resource's
 * authorization parent (null for the church, undefined when it doesn't exist), whether it is
 * archived, the resources of this type directly under a parent in the order people look for them,
 * and what a person needs to recognize one. The evaluator uses only this table.
 */
export type Adapter = {
  parent: (s: State, id: Uuid) => ResourceRef | null | undefined
  archived?: (s: State, id: Uuid) => boolean
  under: (s: State, parent: ResourceRef, today: LocalDate) => Uuid[]
  details: (s: State, id: Uuid) => ResourceDetails | null
}

const MAX_DEPTH = 10

export function unitScope(unit: Unit): ResourceRef {
  return unit.stageId === null
    ? { type: "service", id: unit.serviceId }
    : { type: "stage", id: unit.stageId }
}

/** The unit (stage, or service without stages) a stage or service resource stands for. */
function unitOfRef(s: State, ref: ResourceRef): Unit | null {
  if (ref.type === "stage") {
    const stage = stageOf(s, ref.id)

    return stage ? { serviceId: stage.serviceId, stageId: stage.id } : null
  }

  if (ref.type === "service") {
    const service = serviceOf(s, ref.id)

    return service?.structure === "single" ? { serviceId: service.id, stageId: null } : null
  }

  return null
}

export function scheduleRef(s: State, unit: Unit): ResourceRef {
  const schedule = scheduleFor(s, unit)

  return schedule ? { type: "schedule", id: schedule.id } : unitScope(unit)
}

const named = (name: string | null | undefined): ResourceDetails | null =>
  name === undefined || name === null ? null : { name, date: null, time: null }

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

/** Sessions: the coming ones first, then the past ones from the most recent. */
function sessionOrder(list: Session[], today: LocalDate): Session[] {
  const byTime = (a: Session, b: Session) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)

  return [
    ...list.filter((x) => x.date >= today).sort(byTime),
    ...list.filter((x) => x.date < today).sort((a, b) => byTime(b, a)),
  ]
}

const ADAPTERS: Partial<Record<ResourceType, Adapter>> = {
  church: {
    parent: (_, id) => (id === CHURCH.id ? null : undefined),
    under: () => [],
    details: () => ({ name: null, date: null, time: null }),
  },
  service: {
    parent: (s, id) => (serviceOf(s, id) ? CHURCH : undefined),
    archived: (s, id) => serviceOf(s, id)?.archivedAt != null,
    under: (s, parent) =>
      parent.type === "church"
        ? s.services
            .filter((x) => x.archivedAt === null)
            .sort(byName)
            .map((x) => x.id)
        : [],
    details: (s, id) => named(serviceOf(s, id)?.name),
  },
  stage: {
    parent: (s, id) => {
      const stage = stageOf(s, id)

      return stage ? { type: "service", id: stage.serviceId } : undefined
    },
    archived: (s, id) => stageOf(s, id)?.archivedAt != null,
    under: (s, parent) =>
      parent.type === "service" ? stagesOf(s, parent.id).map((x) => x.id) : [],
    details: (s, id) => named(stageOf(s, id)?.name),
  },
  schedule: {
    parent: (s, id) => {
      const schedule = scheduleOf(s, id)

      return schedule ? unitScope(schedule) : undefined
    },
    under: (s, parent) => {
      const unit = unitOfRef(s, parent)
      const schedule = unit ? scheduleFor(s, unit) : undefined

      return schedule ? [schedule.id] : []
    },
    details: (s, id) => (scheduleOf(s, id) ? { name: null, date: null, time: null } : null),
  },
  session: {
    parent: (s, id) => {
      const session = sessionOf(s, id)

      return session ? { type: "schedule", id: session.scheduleId } : undefined
    },
    under: (s, parent, today) =>
      parent.type === "schedule"
        ? sessionOrder(
            s.sessions.filter((x) => x.scheduleId === parent.id && x.status !== "canceled"),
            today
          ).map((x) => x.id)
        : [],
    details: (s, id) => {
      const session = sessionOf(s, id)

      return session ? { name: null, date: session.date, time: session.startTime } : null
    },
  },
  lesson: {
    parent: (s, id) => {
      const lesson = s.lessons.find((l) => l.id === id)

      return lesson ? unitScope(lesson) : undefined
    },
    under: (s, parent) => {
      const unit = unitOfRef(s, parent)

      return unit
        ? s.lessons
            .filter((l) => l.serviceId === unit.serviceId && l.stageId === unit.stageId)
            .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
            .map((l) => l.id)
        : []
    },
    details: (s, id) => {
      const lesson = s.lessons.find((l) => l.id === id)

      return lesson ? { name: lesson.title, date: lesson.date, time: null } : null
    },
  },
  task: {
    parent: (s, id) => {
      const task = s.tasks.find((t) => t.id === id)

      return task ? { type: "lesson", id: task.lessonId } : undefined
    },
    under: (s, parent) =>
      parent.type === "lesson"
        ? s.tasks
            .filter((t) => t.lessonId === parent.id && t.status !== "archived")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((t) => t.id)
        : [],
    details: (s, id) => {
      const task = s.tasks.find((t) => t.id === id)

      return task ? { name: task.title, date: task.dueDate, time: null } : null
    },
  },
  event: {
    parent: (s, id) => {
      const event = s.events.find((e) => e.id === id)

      if (!event) {
        return undefined
      }

      return event.serviceId ? { type: "service", id: event.serviceId } : CHURCH
    },
    under: (s, parent) => {
      if (parent.type !== "church" && parent.type !== "service") {
        return []
      }

      const serviceId = parent.type === "church" ? null : parent.id

      return s.events
        .filter((e) => e.serviceId === serviceId)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => e.id)
    },
    details: (s, id) => {
      const event = s.events.find((e) => e.id === id)

      return event ? { name: event.name, date: event.date, time: null } : null
    },
  },
}

/** Registers the adapter of a resource type registered at runtime (see registerResourceType). */
export function registerAdapter(type: string, adapter: Adapter): void {
  ADAPTERS[type as ResourceType] = adapter
}

export function unregisterAdapter(type: string): void {
  delete ADAPTERS[type as ResourceType]
}

export function hasAdapter(type: ResourceType): boolean {
  return ADAPTERS[type] !== undefined
}

/**
 * The resource and its authorization parents up to the church, read from storage. Null when the
 * resource or a parent doesn't exist, the type has no adapter, or the data loops: an unknown
 * resource never grants anything.
 */
export function ancestry(s: State, resource: ResourceRef): ResourceRef[] | null {
  const chain: ResourceRef[] = []
  let current: ResourceRef | null = resource

  while (current !== null) {
    const here: ResourceRef = current
    const adapter = ADAPTERS[here.type]

    if (!adapter || chain.length >= MAX_DEPTH || chain.some((r) => sameRef(r, here))) {
      return null
    }

    const parent = adapter.parent(s, here.id)

    if (parent === undefined) {
      return null
    }

    chain.push(here)
    current = parent
  }

  return chain
}

export function exists(s: State, resource: ResourceRef): boolean {
  return ancestry(s, resource) !== null
}

/** Archived services and stages, and everything in them, are read-only. */
export function isArchived(s: State, chain: ResourceRef[]): boolean {
  return chain.some((r) => ADAPTERS[r.type]?.archived?.(s, r.id) === true)
}

export function resourceDetails(s: State, resource: ResourceRef): ResourceDetails | null {
  return ADAPTERS[resource.type]?.details(s, resource.id) ?? null
}

/** The resources of one type directly under a parent, in the adapter's order. */
export function resourcesUnder(
  s: State,
  parent: ResourceRef,
  type: ResourceType,
  today: LocalDate
): ResourceRef[] {
  return (ADAPTERS[type]?.under(s, parent, today) ?? []).map((id) => ({ type, id }))
}

/** The types with resources directly under this one, in registry order. */
export function childTypesOf(s: State, parent: ResourceRef, today: LocalDate): ResourceType[] {
  return childTypes(parent.type).filter(
    (t) => hasAdapter(t) && resourcesUnder(s, parent, t, today).length > 0
  )
}

/** Every resource below `root`, breadth first. */
export function* descendants(
  s: State,
  root: ResourceRef,
  today: LocalDate
): Generator<ResourceRef> {
  const queue = [root]

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const type of childTypes(current.type)) {
      for (const child of resourcesUnder(s, current, type, today)) {
        yield child
        queue.push(child)
      }
    }
  }
}
