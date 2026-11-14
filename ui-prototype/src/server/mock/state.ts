import "server-only"

import type {
  AccessManager,
  Account,
  AnnualPlan,
  AnonymousCounts,
  Attendance,
  CalendarOccasion,
  DataRequest,
  Guardianship,
  Instant,
  Lesson,
  Membership,
  Person,
  Grant,
  Schedule,
  Service,
  ServiceDaysOff,
  Session,
  Stage,
  Task,
  TaskCompletion,
  Uuid,
} from "@/lib/domain/types"

import { seed } from "./seed"

export type State = {
  services: Service[]
  serviceTones: Record<Uuid, number>
  stages: Stage[]
  persons: Person[]
  memberships: Membership[]
  accounts: Account[]
  guardianships: Guardianship[]
  grants: Grant[]
  managers: AccessManager[]
  schedules: Schedule[]
  plans: AnnualPlan[]
  sessions: Session[]
  attendance: Attendance[]
  occasions: CalendarOccasion[]
  daysOff: ServiceDaysOff[]
  lessons: Lesson[]
  tasks: Task[]
  completions: TaskCompletion[]
  dataRequests: DataRequest[]
  anonymousCounts: Record<Uuid, AnonymousCounts>
  seededAt: Instant
}

export type DemoData = "church" | "empty"

const holder = globalThis as typeof globalThis & { __khmkState?: State }

export function getState(): State {
  holder.__khmkState ??= seed("church")

  return holder.__khmkState
}

export function resetState(data: DemoData = "church"): State {
  holder.__khmkState = seed(data)

  return holder.__khmkState
}
