import { matchesQuery } from "@/lib/domain/names"
import { localDateOf } from "@/lib/domain/time"
import type {
  Attendance,
  HomeworkAssignment,
  LocalDate,
  MeetingSchedule,
  MeetingSession,
  Membership,
  Person,
  Service,
  Stage,
  User,
  Uuid,
} from "@/lib/domain/types"

import type { State } from "./state"

/** Read helpers over the mock state. Pure functions; shared by the seed, commands and queries. */

export const byId = <T extends { id: Uuid }>(
  items: T[],
  id: Uuid | null | undefined
): T | undefined => (id ? items.find((i) => i.id === id) : undefined)

export const serviceOf = (s: State, id: Uuid | null | undefined) => byId(s.services, id)
export const stageOf = (s: State, id: Uuid | null | undefined) => byId(s.stages, id)
export const personOf = (s: State, id: Uuid | null | undefined) => byId(s.persons, id)
export const userOf = (s: State, id: Uuid | null | undefined) => byId(s.users, id)
export const scheduleOf = (s: State, id: Uuid | null | undefined) => byId(s.schedules, id)
export const sessionOf = (s: State, id: Uuid | null | undefined) => byId(s.sessions, id)

export const isArchived = (x: Pick<Service | Stage, "archivedAt">) => x.archivedAt !== null

/** Stages of a service in display order; archived ones last. */
export function stagesOf(s: State, serviceId: Uuid, includeArchived = false): Stage[] {
  return s.stages
    .filter((st) => st.serviceId === serviceId && (includeArchived || !isArchived(st)))
    .sort((a, b) => Number(isArchived(a)) - Number(isArchived(b)) || a.position - b.position)
}

export function isCurrentOn(m: Membership, date: LocalDate): boolean {
  return m.startsOn <= date && (m.endsOn === null || m.endsOn >= date)
}

export function membershipsOn(
  s: State,
  serviceId: Uuid,
  stageId: Uuid | null | "any",
  date: LocalDate
): Membership[] {
  return s.memberships.filter(
    (m) =>
      m.serviceId === serviceId &&
      (stageId === "any" || m.stageId === stageId) &&
      isCurrentOn(m, date)
  )
}

const byName = (a: Person, b: Person) =>
  a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de")

/**
 * The roster of a stage, or of the service itself when stageId is null, on a date.
 * Mirrors MembershipRepository::rosterOn: a service-level roster only contains
 * people without a stage, and inactive people are never on a roster.
 */
export function rosterOn(
  s: State,
  serviceId: Uuid,
  stageId: Uuid | null,
  date: LocalDate
): Person[] {
  const ids = new Set(membershipsOn(s, serviceId, stageId, date).map((m) => m.personId))
  return s.persons.filter((p) => ids.has(p.id) && p.status === "active").sort(byName)
}

export function sessionDate(session: MeetingSession): LocalDate {
  return localDateOf(session.startsAt)
}

/** The expected roster of a session; empty for open sessions. */
export function sessionRoster(s: State, session: MeetingSession): Person[] {
  if (session.rosterMode === "open") return []
  return rosterOn(s, session.serviceId, session.stageId, sessionDate(session))
}

export function currentAttendance(s: State, sessionId: Uuid): Attendance[] {
  return s.attendance
    .filter((a) => a.sessionId === sessionId && a.removedAt === null)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
}

export function attendanceHistory(s: State, sessionId: Uuid): Attendance[] {
  return s.attendance.filter((a) => a.sessionId === sessionId)
}

export type SessionCounts = {
  /** Everyone marked present, roster or not. */
  present: number
  /** Size of the expected roster; null for open sessions (no roster). */
  rosterSize: number | null
  rosterPresent: number
  /** Roster members without a "present" mark. Only meaningful with an expected roster. */
  notMarked: number
  /** Present but not on the roster. */
  notOnRoster: number
}

export function sessionCounts(s: State, session: MeetingSession): SessionCounts {
  const present = currentAttendance(s, session.id)
  // People whose data was erased still count, as numbers without names.
  const erased = s.anonymousCounts[session.id] ?? { roster: 0, present: 0, rosterPresent: 0 }
  if (session.rosterMode === "open") {
    return {
      present: present.length + erased.present,
      rosterSize: null,
      rosterPresent: 0,
      notMarked: 0,
      notOnRoster: present.length + erased.present,
    }
  }
  const roster = new Set(sessionRoster(s, session).map((p) => p.id))
  const rosterSize = roster.size + erased.roster
  const rosterPresent = present.filter((a) => roster.has(a.personId)).length + erased.rosterPresent
  const presentTotal = present.length + erased.present
  return {
    present: presentTotal,
    rosterSize,
    rosterPresent,
    notMarked: rosterSize - rosterPresent,
    notOnRoster: presentTotal - rosterPresent,
  }
}

/** Schedules the generator may create sessions for: active, in an active service and stage. */
export function generatableSchedules(s: State): MeetingSchedule[] {
  return s.schedules.filter((sch) => {
    if (!sch.active) return false
    const service = serviceOf(s, sch.serviceId)
    if (!service || isArchived(service)) return false
    if (sch.stageId) {
      const stage = stageOf(s, sch.stageId)
      if (!stage || isArchived(stage)) return false
    }
    return true
  })
}

export function sessionForOccurrence(
  s: State,
  scheduleId: Uuid,
  date: LocalDate
): MeetingSession | undefined {
  return s.sessions.find((x) => x.scheduleId === scheduleId && x.occurrenceDate === date)
}

export function searchPersons(s: State, query: string, includeInactive = false): Person[] {
  return s.persons
    .filter((p) => (includeInactive || p.status === "active") && matchesQuery(p, query))
    .sort(byName)
}

export function usersWithRole(s: State, serviceId: Uuid): User[] {
  return s.users.filter((u) => !u.disabledAt && u.roles.some((r) => r.serviceId === serviceId))
}

export function leadersOf(s: State, serviceId: Uuid): User[] {
  return s.users.filter(
    (u) =>
      !u.disabledAt && u.roles.some((r) => r.serviceId === serviceId && r.role === "service_leader")
  )
}

// ---------------------------------------------------------------- learning

export const lessonOf = (s: State, id: Uuid | null | undefined) => byId(s.lessons, id)
export const homeworkOf = (s: State, id: Uuid | null | undefined) => byId(s.homework, id)

/** The current "completed" report for a child, if any (undone reports are history). */
export function currentCompletion(s: State, assignmentId: Uuid, personId: Uuid) {
  return s.completions.find(
    (c) => c.assignmentId === assignmentId && c.personId === personId && c.undoneAt === null
  )
}

/**
 * Who an assignment is for: everyone currently in the target stage, so a child
 * who joins later receives the stage's active homework. Children who left keep
 * their reported completions (history), flagged as no longer in the stage.
 */
export function homeworkAudience(s: State, assignment: HomeworkAssignment, date: LocalDate) {
  const current = rosterOn(s, assignment.serviceId, assignment.stageId, date)
  const currentIds = new Set(current.map((p) => p.id))
  const former = s.completions
    .filter(
      (c) => c.assignmentId === assignment.id && c.undoneAt === null && !currentIds.has(c.personId)
    )
    .map((c) => personOf(s, c.personId))
    .filter((p): p is Person => !!p)
  return [
    ...current.map((person) => ({ person, inStage: true })),
    ...former.map((person) => ({ person, inStage: false })),
  ]
}

/** The children a user may act for: approved guardian links only. */
export function childrenOf(s: State, userId: Uuid): Person[] {
  const ids = new Set(
    s.guardians.filter((g) => g.userId === userId && g.status === "approved").map((g) => g.personId)
  )
  return s.persons
    .filter((p) => ids.has(p.id))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, "de"))
}

/** Stages a child is in today (for the parent portal: their Sunday School class). */
export function currentStagesOf(
  s: State,
  personId: Uuid,
  date: LocalDate
): { serviceId: Uuid; stageId: Uuid }[] {
  return s.memberships
    .filter((m) => m.personId === personId && m.stageId !== null && isCurrentOn(m, date))
    .map((m) => ({ serviceId: m.serviceId, stageId: m.stageId! }))
}

/** Parent accounts linked to a child (approved). */
export function guardiansOf(s: State, personId: Uuid): User[] {
  const ids = new Set(
    s.guardians
      .filter((g) => g.personId === personId && g.status === "approved")
      .map((g) => g.userId)
  )
  return s.users.filter((u) => ids.has(u.id) && !u.disabledAt)
}
