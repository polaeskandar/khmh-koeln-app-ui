import "server-only"

import { notFound } from "next/navigation"

import type { PlanStatus, Service, Uuid } from "@/lib/domain/types"
import { can, canInService, canSeeService, canSeeUnit } from "@/server/mock/access"
import { scheduleRef } from "@/server/mock/resources"
import { today } from "@/server/mock/clock"
import {
  planOf,
  rosterOf,
  scheduleFor,
  serviceOf,
  stagesOf,
  unitsOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { unitRef } from "./present"

function nextSession(s: State, serviceId: Uuid, stageId: Uuid | null | undefined) {
  const date = today()

  return (
    s.sessions
      .filter(
        (x) =>
          x.serviceId === serviceId &&
          (stageId === undefined || x.stageId === stageId) &&
          x.status !== "canceled" &&
          x.status !== "closed" &&
          x.date >= date
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0] ??
    null
  )
}

function memberCount(s: State, service: Service, stageId?: Uuid | null) {
  const date = today()

  return unitsOf(s, service)
    .filter((u) => stageId === undefined || u.stageId === stageId)
    .reduce((sum, u) => sum + rosterOf(s, u, date).length, 0)
}

export function getServices(ctx: Context, archived: boolean) {
  const { state: s, viewer } = ctx
  const all = s.services.filter((x) => canSeeService(s, viewer, x.id))

  return {
    canCreate: can(s, viewer, "service.create"),
    archivedCount: all.filter((x) => x.archivedAt !== null).length,
    services: all
      .filter((x) => (x.archivedAt !== null) === archived)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => {
        const next = nextSession(s, x.id, undefined)

        return {
          id: x.id,
          name: x.name,
          description: x.description,
          tone: s.serviceTones[x.id] ?? 1,
          structure: x.structure,
          stages: stagesOf(s, x.id)
            .filter((st) => canSeeUnit(s, viewer, { serviceId: x.id, stageId: st.id }))
            .map((st) => ({ id: st.id, name: st.name })),
          members: memberCount(s, x),
          next: next ? { date: next.date, startTime: next.startTime } : null,
        }
      }),
  }
}

export function serviceFor({ state: s, viewer }: Context, serviceId: Uuid): Service {
  const service = serviceOf(s, serviceId)

  if (!service || !canSeeService(s, viewer, service.id)) {
    notFound()
  }

  return service
}

export function planState(
  s: State,
  scheduleId: Uuid | undefined,
  year: number
): PlanStatus | "none" {
  const plan = scheduleId ? planOf(s, scheduleId, year) : undefined

  return plan?.status ?? "none"
}

export function getService(ctx: Context, serviceId: Uuid) {
  const { state: s, viewer } = ctx
  const service = serviceFor(ctx, serviceId)
  const hasHistory =
    s.sessions.some((x) => x.serviceId === service.id) ||
    s.memberships.some((m) => m.serviceId === service.id) ||
    s.lessons.some((l) => l.serviceId === service.id)

  return {
    id: service.id,
    name: service.name,
    description: service.description,
    structure: service.structure,
    archived: service.archivedAt !== null,
    tone: s.serviceTones[service.id] ?? 1,
    hasHistory,
    can: {
      manage: can(s, viewer, "service.update", { type: "service", id: service.id }),
      stages: can(s, viewer, "stage.create", { serviceId: service.id, stageId: null }),
      schedule: canInService(s, viewer, "schedule.plan", service.id),
    },
    stages: stagesOf(s, service.id, true)
      .filter((st) => canSeeUnit(s, viewer, { serviceId: service.id, stageId: st.id }))
      .map((st) => {
        const next = nextSession(s, service.id, st.id)

        return {
          id: st.id,
          name: st.name,
          description: st.description,
          archived: st.archivedAt !== null,
          members: memberCount(s, service, st.id),
          next: next ? { date: next.date, startTime: next.startTime, status: next.status } : null,
        }
      }),
  }
}

export function getScheduleOverview(ctx: Context, serviceId: Uuid, year: number) {
  const { state: s, viewer } = ctx
  const service = serviceFor(ctx, serviceId)

  return unitsOf(s, service)
    .filter((u) => canSeeUnit(s, viewer, u))
    .map((u) => {
      const schedule = scheduleFor(s, u)
      const sessions = s.sessions.filter(
        (x) => x.scheduleId === schedule?.id && x.date.startsWith(`${year}-`)
      )
      const plan = schedule ? planOf(s, schedule.id, year) : undefined

      return {
        unit: unitRef(s, u),
        scheduleId: schedule?.id ?? null,
        status: planState(s, schedule?.id, year),
        rule: plan?.rule ?? null,
        sessions: sessions.filter((x) => x.status !== "canceled").length,
        canceled: sessions.filter((x) => x.status === "canceled").length,
        canManage: can(s, viewer, "schedule.plan", scheduleRef(s, u)),
      }
    })
}
