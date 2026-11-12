export type Uuid = string
export type LocalDate = string
export type LocalTime = string
export type Instant = string

export type Frequency = "weekly" | "monthly"
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number]
export type MonthWeek = 1 | 2 | 3 | 4 | -1

export type Recurrence = {
  frequency: Frequency
  interval: number
  weekdays: IsoWeekday[]
  monthWeek: MonthWeek | null
  startsOn: LocalDate
  endsOn: LocalDate | null
}

export type Language = "en" | "de" | "ar"

export type ServiceStructure = "stages" | "single"

export type Service = {
  id: Uuid
  name: string
  description: string | null
  structure: ServiceStructure
  archivedAt: Instant | null
  createdAt: Instant
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

export type Unit = { serviceId: Uuid; stageId: Uuid | null }

export type Person = {
  id: Uuid
  firstName: string
  lastName: string
  displayName: string | null
  createdAt: Instant
}

export type Membership = {
  id: Uuid
  personId: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  startsOn: LocalDate
  endsOn: LocalDate | null
}

export type Account = {
  id: Uuid
  personId: Uuid
  username: string
  passwordHash: string
  mustChangePassword: boolean
  passwordChangedAt: Instant | null
  language: Language | null
  lastSignInAt: Instant | null
  createdAt: Instant
  createdBy: Uuid | null
}

export type Guardianship = {
  id: Uuid
  accountId: Uuid
  childId: Uuid
  createdAt: Instant
  createdBy: Uuid | null
}

export const CHURCH_PERMISSIONS = [
  "accounts.manage",
  "access.manage",
  "guardians.manage",
  "data.manage",
  "services.manage",
] as const

export const UNIT_PERMISSIONS = [
  "services.view",
  "stages.manage",
  "schedule.manage",
  "attendance.record",
  "attendance.correct",
  "lessons.prepare",
  "lessons.publish",
  "tasks.manage",
] as const

export const PORTAL_PERMISSIONS = ["portal.parent", "portal.member"] as const

export type ChurchPermission = (typeof CHURCH_PERMISSIONS)[number]
export type UnitPermission = (typeof UNIT_PERMISSIONS)[number]
export type PortalPermission = (typeof PORTAL_PERMISSIONS)[number]
export type Permission = ChurchPermission | UnitPermission | PortalPermission

export type Role = {
  id: Uuid
  name: string
  permissions: Permission[]
  protected: boolean
  createdAt: Instant
}

export type Scope =
  | { type: "church" }
  | { type: "service"; serviceId: Uuid }
  | { type: "stage"; serviceId: Uuid; stageId: Uuid }

export type RoleAssignment = {
  id: Uuid
  accountId: Uuid
  roleId: Uuid
  scope: Scope
  createdAt: Instant
  createdBy: Uuid | null
}

export type Schedule = {
  id: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  createdAt: Instant
}

export type PlanStatus = "draft" | "confirmed"

export type PlanRule = {
  frequency: Frequency
  interval: number
  weekday: IsoWeekday
  monthWeek: MonthWeek | null
  startTime: LocalTime
  endTime: LocalTime | null
  startsOn: LocalDate | null
  endsOn: LocalDate | null
  location: string | null
}

export type PlanDecision = "cancel" | "keep"

export type AnnualPlan = {
  id: Uuid
  scheduleId: Uuid
  year: number
  status: PlanStatus
  rule: PlanRule
  decisions: Record<LocalDate, PlanDecision>
  version: number
  updatedAt: Instant
  updatedBy: Uuid | null
  confirmedAt: Instant | null
  confirmedBy: Uuid | null
}

export type SessionKind = "recurring" | "oneOff"
export type SessionStatus = "scheduled" | "open" | "closed" | "canceled"

export type Session = {
  id: Uuid
  scheduleId: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  planId: Uuid | null
  kind: SessionKind
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  status: SessionStatus
  cancelReason: string | null
  occasionId: Uuid | null
  originalDate: LocalDate | null
  changedByHand: boolean
  openedAt: Instant | null
  closedAt: Instant | null
  closedBy: Uuid | null
  createdAt: Instant
}

export type SessionEventType =
  "created" | "opened" | "closed" | "reopened" | "canceled" | "restored" | "rescheduled"

export type SessionEvent = {
  id: Uuid
  sessionId: Uuid
  type: SessionEventType
  occurredAt: Instant
  actorId: Uuid | null
  note: string | null
}

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

export type OccasionCategory =
  | "lordsMajorFeast"
  | "lordsMinorFeast"
  | "holyWeek"
  | "otherFeast"
  | "publicHoliday"
  | "churchEvent"

export type OccasionMode = "suggested" | "mandatory"

export type CalendarOccasion = {
  id: Uuid
  date: LocalDate
  key: string | null
  name: string | null
  category: OccasionCategory
  source: "computed" | "church"
  mode: OccasionMode
  serviceIds: Uuid[]
  verifiedAt: Instant | null
  verifiedBy: Uuid | null
}

export type DaysOffMode = "automatic" | "custom"

export type ServiceDaysOff = { serviceId: Uuid; year: number; mode: DaysOffMode; days: LocalDate[] }

export type LessonStatus = "draft" | "ready" | "published"

export type Material = { label: string; url: string | null; shared: boolean }

export type Lesson = {
  id: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  sessionId: Uuid | null
  date: LocalDate
  title: string
  summary: string | null
  objectives: string | null
  teachingPoints: string | null
  materials: Material[]
  notes: string | null
  status: LessonStatus
  responsibleId: Uuid | null
  publishedAt: Instant | null
  createdAt: Instant
  updatedAt: Instant
}

export type TaskStatus = "draft" | "published" | "archived"

export type Resource = { label: string; url: string | null }

export type Task = {
  id: Uuid
  lessonId: Uuid
  serviceId: Uuid
  stageId: Uuid | null
  title: string
  instructions: string
  dueDate: LocalDate | null
  resources: Resource[]
  status: TaskStatus
  publishedAt: Instant | null
  createdBy: Uuid | null
  createdAt: Instant
  updatedAt: Instant
}

export type TaskCompletion = {
  id: Uuid
  taskId: Uuid
  personId: Uuid
  completedAt: Instant
  completedBy: Uuid | null
  undoneAt: Instant | null
}

export type DataRequestKind = "copy" | "erasure"
export type DataRequestStatus = "open" | "done" | "declined"
export type DataRequestChannel = "app" | "letter" | "in_person"

export type DataRequest = {
  id: Uuid
  kind: DataRequestKind
  personId: Uuid | null
  subjectName: string | null
  erasedSubject: string | null
  requestedBy: string
  channel: DataRequestChannel
  receivedAt: Instant
  dueOn: LocalDate
  note: string | null
  status: DataRequestStatus
  outcome: Record<string, number> | null
  declineReason: string | null
  closedAt: Instant | null
  closedBy: Uuid | null
}

export type AnonymousCounts = { present: number }
