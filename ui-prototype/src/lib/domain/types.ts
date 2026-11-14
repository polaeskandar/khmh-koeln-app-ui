import type { Permission, ResourceRef, ResourceType } from "./resources"

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

export { CHURCH, type Permission, type ResourceRef, type ResourceType } from "./resources"

/** Holders of the role may give and remove `roleId`, on resources of these types in their area. */
export type DelegationRule = { roleId: Uuid; at: ResourceType[] }

/**
 * A named set of permissions. It includes the roles it inherits from (their permissions and
 * delegation rules), may be assigned only on the listed scope types, and lists which roles its
 * holders may give and remove (only with access.assign / access.revoke). The protected role
 * (Administrator) holds everything, assigns every role and can't be weakened or deleted.
 */
export type Role = {
  id: Uuid
  name: string
  description: string | null
  inherits: Uuid[]
  permissions: Permission[]
  assignableAt: ResourceType[]
  delegation: DelegationRule[]
  protected: boolean
  createdAt: Instant
  updatedAt: Instant
}

/**
 * One role for one account on one resource, which it applies to with everything below it. Created
 * by someone allowed to delegate it ("granted"), or by the ownership policy when the account
 * created the resource ("owner").
 */
export type RoleAssignment = {
  id: Uuid
  accountId: Uuid
  roleId: Uuid
  resource: ResourceRef
  origin: "granted" | "owner"
  createdAt: Instant
  createdBy: Uuid | null
}

/**
 * A fictional resource type that exists only to show that a new type plugs into authorization
 * through the registry: it has no screens of its own.
 */
export type ChurchEvent = {
  id: Uuid
  name: string
  serviceId: Uuid | null
  date: LocalDate
  createdAt: Instant
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
