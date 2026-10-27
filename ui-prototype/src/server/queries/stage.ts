import "server-only"

import { can, covers } from "@/lib/domain/policy"
import { addDays, localDateOf } from "@/lib/domain/time"
import type { Uuid } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import { stageImpact } from "@/server/mock/commands/services"
import {
  currentAttendance,
  isArchived,
  isCurrentOn,
  personOf,
  serviceOf,
  sessionRoster,
  stageOf,
  stagesOf,
} from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { sortAgenda, upcomingFor } from "./meetings"
import {
  personRef,
  scheduleSummary,
  serviceRef,
  sessionCard,
  sortSessions,
  stageRef,
  userRef,
} from "./present"
import { memberCount } from "./services"

/** The header shared by a stage's tabs: Overview, Meetings, Attendance, Lessons, Homework. */
export async function getStageHeader(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const service = serviceOf(s, serviceId)
  const stage = stageOf(s, stageId)
  if (!service || !stage || stage.serviceId !== service.id) return null
  const schedule = s.schedules.find((x) => x.stageId === stageId && x.active)
  const servants = s.users
    .filter(
      (u) =>
        !u.disabledAt &&
        u.roles.some(
          (r) =>
            (r.role === "servant" || r.role === "service_leader") && covers(r, serviceId, stageId)
        )
    )
    .map((u) => ({
      ...userRef(u)!,
      leader: u.roles.some((r) => r.role === "service_leader" && r.serviceId === serviceId),
    }))
    .sort((a, b) => Number(a.leader) - Number(b.leader) || a.name.localeCompare(b.name, "de"))
  return {
    service: serviceRef(s, service),
    stage: { ...stageRef(stage)!, description: stage.description, archivedAt: stage.archivedAt },
    members: memberCount(s, serviceId, stageId),
    meets: schedule
      ? {
          pattern: ctx.f.recurrence(schedule.recurrence),
          time: ctx.f.timeRange(schedule.startTime, schedule.endTime),
          location: schedule.location,
        }
      : null,
    servants,
    otherStages: stagesOf(s, serviceId)
      .filter((x) => x.id !== stageId)
      .map((x) => stageRef(x)!),
    impact: (() => {
      const i = stageImpact(s, stageId)
      return {
        members: i.members,
        sessions: i.sessions,
        deleteBlocker:
          i.sessions > 0
            ? ctx.t("stages.deleteBlocked.history", { count: i.sessions })
            : i.members > 0
              ? ctx.t("stages.deleteBlocked.members", { count: i.members })
              : null,
      }
    })(),
    counts: {
      upcomingLessons: s.lessons.filter(
        (l) => l.stageId === stageId && !l.archivedAt && l.teachingDate >= clockToday()
      ).length,
      openHomework: s.homework.filter((h) => h.stageId === stageId && h.status === "published")
        .length,
    },
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

export type StageHeader = NonNullable<Awaited<ReturnType<typeof getStageHeader>>>

export async function getStageMeetings(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  return {
    today,
    schedules: s.schedules
      .filter((x) => x.stageId === stageId)
      .map((x) => scheduleSummary(s, viewer, x)),
    upcoming: upcomingFor(ctx, { serviceId, stageId, days: 35, includeCanceled: true }),
    past: sortSessions(
      s.sessions
        .filter((x) => x.stageId === stageId && localDateOf(x.startsAt) < today)
        .map((x) => sessionCard(s, viewer, x))
    )
      .reverse()
      .slice(0, 12),
    oneOff: sortAgenda(
      s.sessions
        .filter((x) => x.stageId === stageId && x.scheduleId === null)
        .map((x) => sessionCard(s, viewer, x))
    ),
  }
}

/**
 * Attendance history of a stage: the last eight sessions that took attendance
 * against today's members. An empty square means "not marked present", which
 * is only meaningful for sessions with an expected roster.
 */
export async function getStageAttendance(ctx: Context, serviceId: Uuid, stageId: Uuid) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const sessions = s.sessions
    .filter((x) => x.stageId === stageId && x.status === "completed")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8)
    .reverse()
  const memberships = s.memberships.filter((m) => m.stageId === stageId && isCurrentOn(m, today))
  const people = memberships
    .map((m) => personOf(s, m.personId)!)
    .filter((p) => p.status === "active")
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de")
    )
  const columns = sessions.map((x) => {
    const present = new Set(currentAttendance(s, x.id).map((a) => a.personId))
    const roster = new Set(sessionRoster(s, x).map((p) => p.id))
    return { card: sessionCard(s, viewer, x), present, roster }
  })
  return {
    today,
    since: addDays(today, -60),
    sessions: columns.map((c) => c.card),
    rows: people.map((p) => ({
      person: personRef(p),
      cells: columns.map((c) =>
        c.present.has(p.id) ? "present" : c.roster.has(p.id) ? "not-marked" : "not-on-roster"
      ),
      presentCount: columns.filter((c) => c.present.has(p.id)).length,
    })),
  }
}
