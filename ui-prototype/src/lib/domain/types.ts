/**
 * Resource shapes of the prototype's mock data layer. They are a proposal for the Symfony REST API
 * (see docs/data-model.md in the backend repository), to be settled in tickets. Field names are
 * the JSON names (camelCase). Dates are local calendar dates in the church time zone
 * ("2026-11-08"); instants are RFC 3339 strings with an offset ("2026-11-08T12:00:00+01:00"),
 * like PHP's DATE_ATOM.
 */

export type Uuid = string
/** Local calendar date, YYYY-MM-DD, in the church time zone. */
export type LocalDate = string
/** Local wall-clock time, HH:MM. */
export type LocalTime = string
/** RFC 3339 instant with offset. */
export type Instant = string

export type ServiceStatus = "active" | "archived"
export type PersonStatus = "active" | "inactive"
export type Frequency = "weekly" | "monthly"
/** expected: the stage or service roster is expected to attend; open: anyone may attend, there is no roster. */
export type RosterMode = "expected" | "open"
export type SessionStatus = "scheduled" | "active" | "completed" | "canceled"
export type SessionEventType = "opened" | "closed" | "reopened" | "canceled" | "moved" | "edited"
export type Role = "administrator" | "service_leader" | "servant" | "parent"
export type LessonStatus = "draft" | "ready" | "completed"
export type HomeworkStatus = "draft" | "published" | "archived"
export type GuardianStatus = "pending" | "approved" | "revoked"

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number]
/** 1–4 for the nth weekday of the month, -1 for the last one. */
export type MonthWeek = 1 | 2 | 3 | 4 | -1

export type Service = {
  id: Uuid
  name: string
  description: string | null
  archivedAt: Instant | null
  createdAt: Instant
  updatedAt: Instant
}

export type Stage = {
  id: Uuid
  serviceId: Uuid
  name: string
  description: string | null
  position: number
  archivedAt: Instant | null
  createdAt: Instant
}

export type Person = {
  id: Uuid
  firstName: string
  lastName: string
  displayName: string | null
  status: PersonStatus
  createdAt: Instant
}

/** Places a person on a roster: a stage of a service, or the service itself (stageId null). */
export type Membership = {
  id: Uuid
  personId: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  startsOn: LocalDate
  /** Last day (inclusive); null while current. Memberships are ended, never deleted. */
  endsOn: LocalDate | null
}

export type Recurrence = {
  frequency: Frequency
  interval: number
  weekdays: IsoWeekday[]
  monthWeek: MonthWeek | null
  startsOn: LocalDate
  endsOn: LocalDate | null
}

export type MeetingSchedule = {
  id: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  name: string
  description: string | null
  location: string | null
  recurrence: Recurrence
  startTime: LocalTime
  endTime: LocalTime | null
  rosterMode: RosterMode
  active: boolean
  createdAt: Instant
  updatedAt: Instant
}

export type MeetingSession = {
  id: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  /** Null for one-off sessions created by hand. */
  scheduleId: Uuid | null
  /** The schedule occurrence this session stands for. Never changes, even when the session is moved. */
  occurrenceDate: LocalDate
  title: string
  location: string | null
  startsAt: Instant
  endsAt: Instant | null
  status: SessionStatus
  rosterMode: RosterMode
  /** True once someone changed this one session; later schedule edits leave it alone. */
  overridden: boolean
  cancelReason: string | null
  openedAt: Instant | null
  closedAt: Instant | null
  closedBy: Uuid | null
  createdAt: Instant
}

export type SessionEvent = {
  id: Uuid
  sessionId: Uuid
  type: SessionEventType
  occurredAt: Instant
  /** Null when the system did it (e.g. session creation). */
  actorId: Uuid | null
  /** The reason someone gave (cancel, reopen); for a move, the previous start instant. */
  note: string | null
}

/** One "present" mark. Corrections never delete: they set removedAt, so history stays. */
export type Attendance = {
  id: Uuid
  sessionId: Uuid
  personId: Uuid
  recordedAt: Instant
  recordedBy: Uuid | null
  removedAt: Instant | null
  removedBy: Uuid | null
  removalReason: string | null
}

export type RoleAssignment = {
  role: Role
  /** Null for administrators and parents, who are never scoped to a service. */
  serviceId: Uuid | null
  /** Optional narrowing to one stage, e.g. a servant of Sunday School · 3rd Class. */
  stageId: Uuid | null
}

/** The languages of the app. Stored with an account so emails go out in the person's language. */
export type Language = "en" | "de" | "ar"

/** What someone wrote when registering, for the administrator who approves the account. */
export type Registration = {
  /** Who they say they are; the administrator decides the actual roles and links. */
  as: "parent" | "servant"
  /** Parents: their children's names and classes. Servants: where and since when they serve. */
  details: string
  /** Servants: the service they say they serve in. */
  serviceId: Uuid | null
}

/**
 * A sign-in account. Accounts people register themselves wait for an
 * administrator (approvedAt null) and can't be used until then; accounts the
 * office creates are approved at once. Declined registrations are deleted.
 */
export type User = {
  id: Uuid
  email: string
  displayName: string
  personId: Uuid | null
  roles: RoleAssignment[]
  /** Prototype only: a salted scrypt hash. Null until the person chooses a password (invitation). */
  passwordHash: string | null
  language: Language | null
  /** Kept until the account is approved or declined, then deleted (only needed for the decision). */
  registration: Registration | null
  /** When they accepted the privacy notice, and which version. */
  privacyAcceptedAt: Instant | null
  privacyVersion: string | null
  approvedAt: Instant | null
  approvedBy: Uuid | null
  disabledAt: Instant | null
  createdAt: Instant
}

/**
 * A data protection request (DSGVO Art. 15, 17, 20): someone asks for a copy
 * of their data or for it to be erased. The church must answer within one
 * month of receiving it (Art. 12(3)). The request is the record that it did:
 * once erased, the subject's name is replaced with a neutral description, so
 * the log itself keeps no personal data.
 */
export type DataRequest = {
  id: Uuid
  kind: "erasure" | "copy"
  /** Whose data: a member's record, an account, or both (a servant has both). */
  personId: Uuid | null
  userId: Uuid | null
  /** The subject's name while their data exists; null once it is erased. */
  subjectName: string | null
  /** After an erasure: what the subject was, for the log ("a member of 3rd Class"). */
  erasedSubject: { kind: "member" | "account"; group: string | null } | null
  /** Who asked and how: the person themselves in the app, a parent by email… */
  requestedBy: string
  channel: "app" | "email" | "letter" | "in_person"
  receivedAt: Instant
  /** One month after receipt. */
  dueOn: LocalDate
  note: string | null
  status: "open" | "done" | "declined"
  /** What was done, without the data itself: number of records per kind. */
  outcome: Record<string, number> | null
  declineReason: string | null
  closedAt: Instant | null
  closedBy: Uuid | null
}

/**
 * Attendance of erased people, kept as numbers per session so past totals stay
 * right ("12 present") without saying who.
 */
export type AnonymousCounts = {
  /** Were on the roster of the session. */
  roster: number
  /** Were marked present. */
  present: number
  /** Were on the roster and marked present. */
  rosterPresent: number
}

/** A link or a physical item ("Children's Bible, page 112"). */
export type Material = { label: string; url: string | null }

/**
 * The educational content prepared for a meeting. Separate from the meeting
 * session: lessons are prepared weeks ahead, when no session exists yet. The
 * link to the meeting is (scheduleId, teachingDate), the same natural key as a
 * session's (scheduleId, occurrenceDate), so it survives the session being
 * created, moved or canceled. One-off sessions are linked by sessionId.
 */
export type Lesson = {
  id: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  scheduleId: Uuid | null
  sessionId: Uuid | null
  teachingDate: LocalDate
  title: string
  summary: string | null
  passage: string | null
  objectives: string | null
  teachingPoints: string | null
  memoryVerse: string | null
  activities: string | null
  materials: Material[]
  /** Internal notes for the servants; never shown to parents. */
  notes: string | null
  status: LessonStatus
  responsibleId: Uuid
  collaboratorIds: Uuid[]
  completedAt: Instant | null
  archivedAt: Instant | null
  createdAt: Instant
  updatedAt: Instant
}

/** Something a child is asked to learn or practise at home, for a whole stage. */
export type HomeworkAssignment = {
  id: Uuid
  lessonId: Uuid
  serviceId: Uuid
  /** The stage whose children receive it. */
  stageId: Uuid
  title: string
  /** What parents read: plain language, no internal notes. */
  instructions: string
  dueDate: LocalDate | null
  resources: Material[]
  status: HomeworkStatus
  publishedAt: Instant | null
  archivedAt: Instant | null
  createdBy: Uuid
  createdAt: Instant
  updatedAt: Instant
}

/**
 * A parent's report that a child completed an assignment. "Not completed" is
 * the absence of a current row. Undo keeps the row and sets undoneAt, so the
 * history stays; at most one current row per child and assignment.
 */
export type HomeworkCompletion = {
  id: Uuid
  assignmentId: Uuid
  personId: Uuid
  completedAt: Instant
  completedBy: Uuid
  undoneAt: Instant | null
  undoneBy: Uuid | null
}

/** An approved link between a parent's account and a child (a person without an account). */
export type GuardianRelationship = {
  id: Uuid
  userId: Uuid
  personId: Uuid
  relationship: "parent" | "guardian"
  status: GuardianStatus
  approvedBy: Uuid | null
  approvedAt: Instant | null
  createdAt: Instant
}
