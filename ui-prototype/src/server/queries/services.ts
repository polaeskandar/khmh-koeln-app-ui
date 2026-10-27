import "server-only"

import { nameKey } from "@/lib/domain/names"
import { can } from "@/lib/domain/policy"
import { addDays, localDateOf } from "@/lib/domain/time"
import type { LocalDate, Service, Stage, Uuid } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import { serviceImpact, stageImpact } from "@/server/mock/commands/services"
import {
  isArchived,
  isCurrentOn,
  leadersOf,
  personOf,
  rosterOn,
  serviceOf,
  sessionCounts,
  stageOf,
  stagesOf,
  usersWithRole,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { upcomingFor } from "./meetings"
import { personRef, scheduleSummary, serviceRef, sessionCard, stageRef, userRef } from "./present"

/** Distinct active people with a current membership in the service (or one stage of it). */
export function memberCount(
  s: State,
  serviceId: Uuid,
  stageId?: Uuid,
  date: LocalDate = clockToday()
): number {
  const ids = new Set(
    s.memberships
      .filter(
        (m) =>
          m.serviceId === serviceId &&
          (stageId === undefined || m.stageId === stageId) &&
          isCurrentOn(m, date)
      )
      .map((m) => m.personId)
  )
  return [...ids].filter((id) => personOf(s, id)?.status === "active").length
}

/**
 * Attendance over the last four weeks. For sessions with an expected roster
 * it is the share of the roster marked present; open sessions only have a
 * head count. Canceled sessions and sessions without attendance are ignored.
 */
export function attendanceTrend(s: State, filter: { serviceId: Uuid; stageId?: Uuid }) {
  const to = clockToday()
  const from = addDays(to, -28)
  const sessions = s.sessions.filter(
    (x) =>
      x.serviceId === filter.serviceId &&
      (filter.stageId === undefined || x.stageId === filter.stageId) &&
      x.status === "completed" &&
      localDateOf(x.startsAt) >= from &&
      localDateOf(x.startsAt) < to
  )
  const expected = sessions.filter((x) => x.rosterMode === "expected")
  let rosterTotal = 0
  let presentTotal = 0
  for (const x of expected) {
    const c = sessionCounts(s, x)
    rosterTotal += c.rosterSize ?? 0
    presentTotal += c.rosterPresent
  }
  const open = sessions.filter((x) => x.rosterMode === "open")
  const openPresent = open.reduce((sum, x) => sum + sessionCounts(s, x).present, 0)
  return {
    sessions: sessions.length,
    rate: rosterTotal > 0 ? presentTotal / rosterTotal : null,
    averagePresent: open.length > 0 ? Math.round(openPresent / open.length) : null,
  }
}

function serviceRow(ctx: Context, service: Service) {
  const { state: s, viewer } = ctx
  const stages = stagesOf(s, service.id)
  const schedules = s.schedules.filter((x) => x.serviceId === service.id)
  const next = upcomingFor(ctx, { serviceId: service.id, days: 21 })[0] ?? null
  const impact = serviceImpact(s, service.id)
  return {
    ...serviceRef(s, service),
    description: service.description,
    archivedAt: service.archivedAt,
    createdAt: service.createdAt,
    stageCount: stages.length,
    stageNames: stages.map((x) => x.name),
    memberCount: memberCount(s, service.id),
    activeSchedules: schedules.filter((x) => x.active).length,
    next: next
      ? {
          date: next.date,
          startTime: next.startTime,
          group: next.group,
          status: next.kind === "session" ? next.status : ("planned" as const),
        }
      : null,
    trend: attendanceTrend(s, { serviceId: service.id }),
    leaders: leadersOf(s, service.id).map((u) => userRef(u)!),
    canDelete: impact.sessions === 0,
    impact,
    can: {
      edit: can(viewer, "EDIT_SERVICE", service.id),
      archive: can(viewer, "ARCHIVE_SERVICE", service.id),
    },
  }
}

export type ServiceRow = ReturnType<typeof serviceRow>

export async function listServices(ctx: Context) {
  const rows = [...ctx.state.services]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((service) => serviceRow(ctx, service))
  return {
    rows,
    canCreate: can(ctx.viewer, "CREATE_SERVICE"),
    existingNames: ctx.state.services.map((x) => ({
      key: nameKey(x.name),
      name: x.name,
      archived: isArchived(x),
    })),
  }
}

export async function getServiceDetail(ctx: Context, id: Uuid) {
  const { state: s, viewer } = ctx
  const service = serviceOf(s, id)
  if (!service) return null
  const today = clockToday()
  const stages = stagesOf(s, id).map((stage) => stageRow(ctx, stage))
  // Same order as the stages: service-wide schedules first, then stage by stage.
  const position = (stageId: Uuid | null) => stageOf(s, stageId)?.position ?? -1
  const schedules = s.schedules
    .filter((x) => x.serviceId === id)
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        position(a.stageId) - position(b.stageId) ||
        a.name.localeCompare(b.name, "de")
    )
    .map((x) => scheduleSummary(s, viewer, x))
  // Latest day first; the sessions of one day in stage order.
  const recent = s.sessions
    .filter((x) => x.serviceId === id && x.status === "completed")
    .map((x) => sessionCard(s, viewer, x))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.order - b.order || a.startTime.localeCompare(b.startTime)
    )
    .slice(0, 6)
  const team = usersWithRole(s, id).map((u) => ({
    ...userRef(u)!,
    roles: u.roles
      .filter((r) => r.serviceId === id)
      .map((r) => ({ role: r.role, stage: stageOf(s, r.stageId)?.name ?? null })),
  }))
  return {
    service: {
      ...serviceRef(s, service),
      description: service.description,
      archivedAt: service.archivedAt,
      createdAt: service.createdAt,
    },
    stages,
    archivedStages: stagesOf(s, id, true)
      .filter(isArchived)
      .map((x) => stageRef(x)!),
    schedules,
    upcoming: upcomingFor(ctx, { serviceId: id, days: 14 }).slice(0, 8),
    recent,
    team,
    stats: {
      members: memberCount(s, id),
      serviceLevelMembers: rosterOn(s, id, null, today).length,
      trend: attendanceTrend(s, { serviceId: id }),
    },
    impact: serviceImpact(s, id),
    can: {
      edit: can(viewer, "EDIT_SERVICE", id),
      archive: can(viewer, "ARCHIVE_SERVICE", id),
      structure: can(viewer, "MANAGE_STRUCTURE", id),
      sessions: can(viewer, "MANAGE_SESSIONS", id),
      roles: can(viewer, "MANAGE_USERS"),
    },
  }
}

function stageRow(ctx: Context, stage: Stage) {
  const { state: s, viewer } = ctx
  const schedules = s.schedules.filter((x) => x.stageId === stage.id)
  const active = schedules.find((x) => x.active)
  const next =
    upcomingFor(ctx, { serviceId: stage.serviceId, stageId: stage.id, days: 14 })[0] ?? null
  const last = s.sessions
    .filter((x) => x.stageId === stage.id && x.status === "completed")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]
  const impact = stageImpact(s, stage.id)
  return {
    ...stageRef(stage)!,
    description: stage.description,
    position: stage.position,
    members: memberCount(s, stage.serviceId, stage.id),
    meets: active
      ? `${ctx.f.recurrence(active.recurrence)} · ${ctx.f.timeRange(active.startTime, active.endTime)}`
      : null,
    schedules: schedules.length,
    next: next
      ? {
          date: next.date,
          startTime: next.startTime,
          status: next.kind === "session" ? next.status : ("planned" as const),
          id: next.kind === "session" ? next.id : null,
        }
      : null,
    last: last ? sessionCard(s, viewer, last) : null,
    trend: attendanceTrend(s, { serviceId: stage.serviceId, stageId: stage.id }),
    sessions: impact.sessions,
    canDelete: impact.sessions === 0 && impact.members === 0,
    deleteBlocker:
      impact.sessions > 0
        ? ctx.t("stages.deleteBlocked.history", { count: impact.sessions })
        : impact.members > 0
          ? ctx.t("stages.deleteBlocked.members", { count: impact.members })
          : null,
  }
}

export type StageRow = ReturnType<typeof stageRow>

export async function getStageManagement(ctx: Context, serviceId: Uuid) {
  const { state: s, viewer } = ctx
  const service = serviceOf(s, serviceId)
  if (!service) return null
  return {
    service: { ...serviceRef(s, service), description: service.description },
    stages: stagesOf(s, serviceId).map((x) => stageRow(ctx, x)),
    archived: stagesOf(s, serviceId, true)
      .filter(isArchived)
      .map((x) => ({ ...stageRow(ctx, x), archivedAt: x.archivedAt })),
    serviceLevelMembers: rosterOn(s, serviceId, null, clockToday()).length,
    can: { structure: can(viewer, "MANAGE_STRUCTURE", serviceId) && !isArchived(service) },
  }
}

export async function getStageDetail(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const service = serviceOf(s, serviceId)
  const stage = stageOf(s, stageId)
  if (!service || !stage || stage.serviceId !== serviceId) return null
  const today = clockToday()
  const memberships = s.memberships.filter((m) => m.stageId === stageId && isCurrentOn(m, today))
  const members = memberships
    .map((m) => ({
      membershipId: m.id,
      since: m.startsOn,
      person: personRef(personOf(s, m.personId)!),
    }))
    .filter((m) => m.person.status === "active")
    .sort(
      (a, b) =>
        a.person.lastName.localeCompare(b.person.lastName, "de") ||
        a.person.firstName.localeCompare(b.person.firstName, "de")
    )
  const recent = s.sessions
    .filter((x) => x.stageId === stageId && x.status === "completed")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8)
    .map((x) => sessionCard(s, viewer, x))
  // Attendance per person over the last eight completed sessions: a quick way to see who has not been coming.
  const lastSessions = recent.slice(0, 8)
  const presentBySession = new Map(
    lastSessions.map((x) => [
      x.id,
      new Set(
        s.attendance.filter((a) => a.sessionId === x.id && !a.removedAt).map((a) => a.personId)
      ),
    ])
  )
  return {
    service: serviceRef(s, service),
    stage: { ...stageRow(ctx, stage), archivedAt: stage.archivedAt },
    otherStages: stagesOf(s, serviceId)
      .filter((x) => x.id !== stageId)
      .map((x) => stageRef(x)!),
    members: members.map((m) => ({
      ...m,
      recent: lastSessions.map((x) => presentBySession.get(x.id)!.has(m.person.id)).reverse(),
    })),
    recentDates: lastSessions.map((x) => x.date).reverse(),
    schedules: s.schedules
      .filter((x) => x.stageId === stageId)
      .map((x) => scheduleSummary(s, viewer, x)),
    upcoming: upcomingFor(ctx, { serviceId, stageId, days: 21 }).slice(0, 5),
    recent,
    can: {
      structure: can(viewer, "MANAGE_STRUCTURE", serviceId) && !isArchived(service),
      members:
        can(viewer, "MANAGE_MEMBERS", serviceId, stageId) &&
        !isArchived(service) &&
        !isArchived(stage),
      sessions: can(viewer, "MANAGE_SESSIONS", serviceId),
    },
  }
}
