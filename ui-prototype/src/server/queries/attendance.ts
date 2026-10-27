import "server-only"

import { can, canAnywhere } from "@/lib/domain/policy"
import { addDays, localDateOf } from "@/lib/domain/time"
import type { Attendance, Uuid } from "@/lib/domain/types"
import type { AttendanceEntry, PersonRef } from "@/lib/view-models"
import { today as clockToday } from "@/server/mock/clock"
import {
  attendanceHistory,
  isCurrentOn,
  personOf,
  serviceOf,
  sessionOf,
  sessionRoster,
  stageOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { sessionHistory, todaysSessions } from "./meetings"
import { personRef, sessionCard, sortSessions, userRef } from "./present"

function entry(s: State, a: Attendance, rosterIds: Set<Uuid>): AttendanceEntry {
  return {
    id: a.id,
    person: personRef(personOf(s, a.personId)!),
    recordedAt: a.recordedAt,
    recordedBy: userRef(userOf(s, a.recordedBy)),
    removedAt: a.removedAt,
    removedBy: userRef(userOf(s, a.removedBy)),
    removalReason: a.removalReason,
    onRoster: rosterIds.has(a.personId),
  }
}

const byPersonName = (a: { person: PersonRef }, b: { person: PersonRef }) =>
  a.person.lastName.localeCompare(b.person.lastName, "de") ||
  a.person.firstName.localeCompare(b.person.firstName, "de")

/** Where a person belongs today, e.g. "Sunday School · 3rd Class". Helps tell namesakes apart. */
function placementsOf(s: State, personId: Uuid): string[] {
  const date = clockToday()
  return s.memberships
    .filter((m) => m.personId === personId && isCurrentOn(m, date))
    .map((m) => {
      const service = serviceOf(s, m.serviceId)!
      const stage = stageOf(s, m.stageId)
      return stage ? `${service.name} · ${stage.name}` : service.name
    })
    .sort()
}

export async function getAttendanceHome(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const sessions = todaysSessions(ctx)
  const earlier = sortSessions(
    s.sessions
      .filter(
        (x) =>
          can(viewer, "RECORD_ATTENDANCE", x.serviceId, x.stageId) &&
          localDateOf(x.startsAt) < today &&
          localDateOf(x.startsAt) >= addDays(today, -21) &&
          (x.status === "scheduled" || x.status === "active")
      )
      .map((x) => sessionCard(s, viewer, x))
  )
  const closed = s.sessions
    .filter(
      (x) =>
        can(viewer, "RECORD_ATTENDANCE", x.serviceId, x.stageId) &&
        x.status === "completed" &&
        x.closedAt
    )
    .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))
    .slice(0, 6)
    .map((x) => sessionCard(s, viewer, x))
  return {
    today,
    sessions,
    earlier,
    closed,
    canRecordAnywhere: canAnywhere(viewer, "RECORD_ATTENDANCE"),
  }
}

export async function getAttendanceBoard(ctx: Context, sessionId: Uuid) {
  const { state: s, viewer } = ctx
  const session = sessionOf(s, sessionId)
  if (!session) return null
  const card = sessionCard(s, viewer, session)
  const roster = sessionRoster(s, session)
  const rosterIds = new Set(roster.map((p) => p.id))
  const all = attendanceHistory(s, sessionId)
  const current = all.filter((a) => !a.removedAt).map((a) => entry(s, a, rosterIds))
  const currentByPerson = new Map(current.map((e) => [e.person.id, e]))
  const removed = all
    .filter((a) => a.removedAt)
    .map((a) => entry(s, a, rosterIds))
    .sort((a, b) => b.removedAt!.localeCompare(a.removedAt!))
  const rosterRows = roster
    .map((p) => ({
      person: personRef(p),
      entry: currentByPerson.get(p.id) ?? null,
      placements: placementsOf(s, p.id),
    }))
    .sort(byPersonName)
  // Everyone else who could be marked present (not on this roster): for visitors and namesakes.
  const others = s.persons
    .filter((p) => p.status === "active" && !rosterIds.has(p.id))
    .map((p) => ({
      person: personRef(p),
      entry: currentByPerson.get(p.id) ?? null,
      placements: placementsOf(s, p.id),
    }))
    .sort(byPersonName)
  return {
    session: card,
    roster: rosterRows,
    others,
    present: current.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    removed,
    history: sessionHistory(s, session),
    today: clockToday(),
    can: {
      record: can(viewer, "RECORD_ATTENDANCE", session.serviceId, session.stageId),
      reopen: can(viewer, "REOPEN_SESSION", session.serviceId),
      manage: can(viewer, "MANAGE_SESSIONS", session.serviceId),
    },
  }
}

export type AttendanceBoard = NonNullable<Awaited<ReturnType<typeof getAttendanceBoard>>>

export async function getAttendanceSummary(ctx: Context, sessionId: Uuid) {
  const { state: s, viewer } = ctx
  const session = sessionOf(s, sessionId)
  if (!session) return null
  const roster = sessionRoster(s, session)
  const rosterIds = new Set(roster.map((p) => p.id))
  const all = attendanceHistory(s, sessionId).map((a) => entry(s, a, rosterIds))
  const present = all.filter((e) => !e.removedAt)
  const presentIds = new Set(present.map((e) => e.person.id))
  return {
    session: sessionCard(s, viewer, session),
    present: present.filter((e) => e.onRoster || session.rosterMode === "open").sort(byPersonName),
    notOnRoster:
      session.rosterMode === "open" ? [] : present.filter((e) => !e.onRoster).sort(byPersonName),
    notMarked: roster
      .filter((p) => !presentIds.has(p.id))
      .map((p) => ({ person: personRef(p) }))
      .sort(byPersonName),
    corrections: all
      .filter((e) => e.removedAt)
      .sort((a, b) => a.removedAt!.localeCompare(b.removedAt!)),
    /** People whose data was erased: counted in the totals, but no longer listed by name. */
    erasedPresent: s.anonymousCounts[session.id]?.present ?? 0,
    history: sessionHistory(s, session),
    today: clockToday(),
  }
}

export type AttendanceSummary = NonNullable<Awaited<ReturnType<typeof getAttendanceSummary>>>
