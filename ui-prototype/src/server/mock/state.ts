import "server-only"

import type {
  AnonymousCounts,
  Attendance,
  DataRequest,
  GuardianRelationship,
  HomeworkAssignment,
  HomeworkCompletion,
  Lesson,
  Instant,
  LocalDate,
  MeetingSchedule,
  MeetingSession,
  Membership,
  Person,
  Service,
  SessionEvent,
  Stage,
  User,
  Uuid,
} from "@/lib/domain/types"

import { seed } from "./seed"

/**
 * The prototype's in-memory database. It lives in the Next.js server process
 * (on globalThis, so it survives hot reloads in development) and is rebuilt
 * from the deterministic seed when the server restarts or someone resets the
 * demo data. Nothing here is persisted; the Symfony API replaces it.
 */
export type GeneratorRun = {
  ranAt: Instant
  today: LocalDate
  tomorrow: LocalDate
  created: number
  existing: number
}

export type State = {
  services: Service[]
  /**
   * Each service's identity colour slot (1–8), fixed when the service is
   * created, so deleting one never repaints the others. A display detail of
   * the prototype: the API may store a colour or leave it to the client.
   */
  serviceTones: Record<Uuid, number>
  stages: Stage[]
  persons: Person[]
  memberships: Membership[]
  schedules: MeetingSchedule[]
  sessions: MeetingSession[]
  events: SessionEvent[]
  attendance: Attendance[]
  users: User[]
  guardians: GuardianRelationship[]
  lessons: Lesson[]
  homework: HomeworkAssignment[]
  completions: HomeworkCompletion[]
  /** Data protection requests (copy or erasure), with their outcome. */
  dataRequests: DataRequest[]
  /** Per session: attendance of people whose data was erased, as numbers only. */
  anonymousCounts: Record<Uuid, AnonymousCounts>
  generatorRuns: GeneratorRun[]
  seededAt: Instant
}

const holder = globalThis as typeof globalThis & { __khmkMockState?: State }

export function getState(): State {
  holder.__khmkMockState ??= seed()
  return holder.__khmkMockState
}

export function resetState(): State {
  holder.__khmkMockState = seed()
  return holder.__khmkMockState
}
