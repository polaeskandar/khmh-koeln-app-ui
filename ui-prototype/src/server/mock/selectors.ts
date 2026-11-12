import { unitName } from "@/lib/domain/names"
import type {
  Account,
  AnnualPlan,
  LocalDate,
  Membership,
  Person,
  Schedule,
  Service,
  Session,
  Stage,
  Unit,
  Uuid,
} from "@/lib/domain/types"

import type { State } from "./state"

export const serviceOf = (s: State, id: Uuid | null | undefined): Service | undefined =>
  id ? s.services.find((x) => x.id === id) : undefined

export const stageOf = (s: State, id: Uuid | null | undefined): Stage | undefined =>
  id ? s.stages.find((x) => x.id === id) : undefined

export const personOf = (s: State, id: Uuid | null | undefined): Person | undefined =>
  id ? s.persons.find((x) => x.id === id) : undefined

export const accountOf = (s: State, id: Uuid | null | undefined): Account | undefined =>
  id ? s.accounts.find((x) => x.id === id) : undefined

export const accountOfPerson = (s: State, personId: Uuid): Account | undefined =>
  s.accounts.find((a) => a.personId === personId)

export const sessionOf = (s: State, id: Uuid | null | undefined): Session | undefined =>
  id ? s.sessions.find((x) => x.id === id) : undefined

export const scheduleOf = (s: State, id: Uuid | null | undefined): Schedule | undefined =>
  id ? s.schedules.find((x) => x.id === id) : undefined

export const scheduleFor = (s: State, unit: Unit): Schedule | undefined =>
  s.schedules.find((x) => x.serviceId === unit.serviceId && x.stageId === unit.stageId)

export const planOf = (s: State, scheduleId: Uuid, year: number): AnnualPlan | undefined =>
  s.plans.find((p) => p.scheduleId === scheduleId && p.year === year)

export function stagesOf(s: State, serviceId: Uuid, includeArchived = false): Stage[] {
  return s.stages
    .filter((x) => x.serviceId === serviceId && (includeArchived || x.archivedAt === null))
    .sort((a, b) => a.position - b.position)
}

export function unitsOf(s: State, service: Service): Unit[] {
  if (service.structure === "single") {
    return [{ serviceId: service.id, stageId: null }]
  }

  return stagesOf(s, service.id).map((stage) => ({ serviceId: service.id, stageId: stage.id }))
}

export function unitLabel(s: State, unit: Unit): string {
  return unitName(serviceOf(s, unit.serviceId)?.name ?? "", stageOf(s, unit.stageId)?.name ?? null)
}

export function isCurrentOn(m: Membership, date: LocalDate): boolean {
  return m.startsOn <= date && (m.endsOn === null || m.endsOn >= date)
}

export function rosterOf(s: State, unit: Unit, date: LocalDate): Person[] {
  const ids = new Set(
    s.memberships
      .filter(
        (m) => m.serviceId === unit.serviceId && m.stageId === unit.stageId && isCurrentOn(m, date)
      )
      .map((m) => m.personId)
  )

  return s.persons.filter((p) => ids.has(p.id))
}

export function currentUnitsOfPerson(s: State, personId: Uuid, date: LocalDate): Unit[] {
  return s.memberships
    .filter((m) => m.personId === personId && isCurrentOn(m, date))
    .map((m) => ({ serviceId: m.serviceId, stageId: m.stageId }))
}

export function childrenOf(s: State, accountId: Uuid): Person[] {
  const ids = new Set(
    s.guardianships.filter((g) => g.accountId === accountId).map((g) => g.childId)
  )

  return s.persons.filter((p) => ids.has(p.id))
}

export function guardianAccountsOf(s: State, childId: Uuid): Account[] {
  const ids = new Set(s.guardianships.filter((g) => g.childId === childId).map((g) => g.accountId))

  return s.accounts.filter((a) => ids.has(a.id))
}

export function presentIds(s: State, sessionId: Uuid): Set<Uuid> {
  return new Set(
    s.attendance
      .filter((a) => a.sessionId === sessionId && a.removedAt === null)
      .map((a) => a.personId)
  )
}

export function hasAttendance(s: State, sessionId: Uuid): boolean {
  return s.attendance.some((a) => a.sessionId === sessionId)
}

export function sameUnit(a: Unit, b: Unit): boolean {
  return a.serviceId === b.serviceId && a.stageId === b.stageId
}
