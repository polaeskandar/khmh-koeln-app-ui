import type {
  Instant,
  LocalDate,
  LocalTime,
  PersonStatus,
  Recurrence,
  Role,
  RosterMode,
  SessionEventType,
  SessionStatus,
  Uuid,
} from "@/lib/domain/types"

/**
 * Read models the pages render. They are what a "backend for frontend" call
 * would return: plain, serializable, with permissions already resolved for
 * the signed-in person.
 */

export type ServiceRef = { id: Uuid; name: string; tone: number; archived: boolean }
export type StageRef = { id: Uuid; name: string; archived: boolean }
export type UserRef = { id: Uuid; name: string; initials: string }
export type PersonRef = {
  id: Uuid
  firstName: string
  lastName: string
  displayName: string | null
  /** Display name and last name if a display name is set, otherwise the full name. */
  name: string
  fullName: string
  initials: string
  status: PersonStatus
}

export type Counts = {
  present: number
  rosterSize: number | null
  rosterPresent: number
  notMarked: number
  notOnRoster: number
}

export type SessionCard = {
  kind: "session"
  id: Uuid
  title: string
  /** The stage name, or the service name for service-wide sessions. */
  group: string
  /** Sort key within a service: the stage's display position, -1 for service-wide sessions. */
  order: number
  service: ServiceRef
  stage: StageRef | null
  scheduleId: Uuid | null
  date: LocalDate
  occurrenceDate: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  startsAt: Instant
  location: string | null
  status: SessionStatus
  rosterMode: RosterMode
  moved: boolean
  oneOff: boolean
  cancelReason: string | null
  counts: Counts
  openedAt: Instant | null
  closedAt: Instant | null
  closedBy: UserRef | null
  can: { record: boolean; manage: boolean; reopen: boolean }
}

/** A future date of a schedule that has no session yet; it is created the day before. */
export type PlannedOccurrence = {
  kind: "planned"
  key: string
  scheduleId: Uuid
  title: string
  group: string
  order: number
  service: ServiceRef
  stage: StageRef | null
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  rosterMode: RosterMode
  rosterSize: number | null
  createdOn: LocalDate
  can: { manage: boolean }
}

export type AgendaItem = SessionCard | PlannedOccurrence

export type ScheduleSummary = {
  id: Uuid
  name: string
  description: string | null
  service: ServiceRef
  stage: StageRef | null
  group: string
  recurrence: Recurrence
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  rosterMode: RosterMode
  rosterSize: number | null
  active: boolean
  next: {
    date: LocalDate
    startTime: LocalTime
    status: SessionStatus | "planned"
    moved: boolean
  } | null
  sessionCount: number
  can: { manage: boolean }
}

export type HistoryEntry = {
  id: string
  type: SessionEventType | "created"
  at: Instant
  actor: UserRef | null
  /** A reason someone wrote (cancel, reopen). */
  note: string | null
  /** What the system knows: how the session was created, or where a moved session was before. */
  detail: { kind: "fromSchedule" } | { kind: "byHand" } | { kind: "movedFrom"; at: Instant } | null
}

export type AttendanceEntry = {
  id: Uuid
  person: PersonRef
  recordedAt: Instant
  recordedBy: UserRef | null
  removedAt: Instant | null
  removedBy: UserRef | null
  removalReason: string | null
  onRoster: boolean
}

export type Membership = {
  id: Uuid
  service: ServiceRef
  stage: StageRef | null
  startsOn: LocalDate
  endsOn: LocalDate | null
}

export type ViewerInfo = {
  id: Uuid
  name: string
  initials: string
  email: string
  roleSummary: string
  roles: { role: Role; service: ServiceRef | null; stage: StageRef | null }[]
  isAdmin: boolean
  /** Has a role in the church app (administrator, leader or servant). */
  isStaff: boolean
  /** Has approved access to at least one child in the parent portal. */
  isParent: boolean
}

/** Chronological, then by service, then in the stages' display order. */
export function compareAgenda(
  a: { date: LocalDate; startTime: LocalTime; service: ServiceRef; order: number; group: string },
  b: { date: LocalDate; startTime: LocalTime; service: ServiceRef; order: number; group: string }
): number {
  return (
    `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`) ||
    a.service.name.localeCompare(b.service.name, "de") ||
    a.order - b.order ||
    a.group.localeCompare(b.group, "de")
  )
}
