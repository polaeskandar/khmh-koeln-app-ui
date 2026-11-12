import type {
  LocalDate,
  LocalTime,
  OccasionCategory,
  SessionKind,
  SessionStatus,
  Uuid,
} from "@/lib/domain/types"

export type UnitRef = {
  serviceId: Uuid
  stageId: Uuid | null
  serviceName: string
  stageName: string | null
  name: string
  tone: number
}

export type PersonRef = { id: Uuid; name: string; initials: string; lastName: string }

export type AccountRef = { id: Uuid; name: string; username: string }

export type OccasionRef = {
  id: Uuid
  key: string | null
  name: string | null
  category: OccasionCategory
}

export type SessionCard = {
  id: Uuid
  unit: UnitRef
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  status: SessionStatus
  kind: SessionKind
  cancelReason: string | null
  occasion: OccasionRef | null
  changedByHand: boolean
  originalDate: LocalDate | null
  present: number
  roster: number
  canRecord: boolean
  canManage: boolean
}

export type ViewerInfo = {
  id: Uuid
  name: string
  firstName: string
  initials: string
  username: string
  roleSummary: string
  areas: { staff: boolean; parent: boolean; member: boolean }
}
