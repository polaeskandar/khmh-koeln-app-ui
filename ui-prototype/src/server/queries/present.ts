import "server-only"

import { fullName, initials, unitName } from "@/lib/domain/names"
import type { Account, Person, Session, Unit, Uuid } from "@/lib/domain/types"
import type { AccountRef, PersonRef, SessionCard, UnitRef, ViewerInfo } from "@/lib/view-models"
import { can, isStaff, sessionRef } from "@/server/mock/access"
import {
  accountOf,
  personOf,
  presentIds,
  rosterOf,
  serviceOf,
  stageOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

export function unitRef(s: State, unit: Unit): UnitRef {
  const service = serviceOf(s, unit.serviceId)
  const stage = stageOf(s, unit.stageId)
  const serviceName = service?.name ?? ""

  return {
    serviceId: unit.serviceId,
    stageId: unit.stageId,
    serviceName,
    stageName: stage?.name ?? null,
    name: unitName(serviceName, stage?.name ?? null),
    tone: s.serviceTones[unit.serviceId] ?? 1,
  }
}

export function personRef(p: Person): PersonRef {
  return { id: p.id, name: fullName(p), initials: initials(p), lastName: p.lastName }
}

export function accountName(s: State, account: Account): string {
  const person = personOf(s, account.personId)

  return person ? fullName(person) : account.username
}

export function accountRef(s: State, id: Uuid | null): AccountRef | null {
  const account = accountOf(s, id)

  return account
    ? { id: account.id, name: accountName(s, account), username: account.username }
    : null
}

export const unitOf = (x: { serviceId: Uuid; stageId: Uuid | null }): Unit => ({
  serviceId: x.serviceId,
  stageId: x.stageId,
})

export function sessionCard({ state: s, viewer }: Context, x: Session): SessionCard {
  const unit = unitOf(x)
  const occasion = s.occasions.find((o) => o.id === x.occasionId)
  const anonymous = s.anonymousCounts[x.id]?.present ?? 0

  return {
    id: x.id,
    unit: unitRef(s, unit),
    date: x.date,
    startTime: x.startTime,
    endTime: x.endTime,
    location: x.location,
    status: x.status,
    kind: x.kind,
    cancelReason: x.cancelReason,
    occasion: occasion
      ? { id: occasion.id, key: occasion.key, name: occasion.name, category: occasion.category }
      : null,
    changedByHand: x.changedByHand,
    originalDate: x.originalDate,
    present: presentIds(s, x.id).size + anonymous,
    roster: rosterOf(s, unit, x.date).length,
    canRecord: can(s, viewer, "session.takeAttendance", sessionRef(x.id)),
    canManage: can(s, viewer, "session.update", sessionRef(x.id)),
  }
}

export function bySessionTime(a: Session, b: Session) {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
}

export function roleSummary(s: State, account: Account): string {
  const names = [
    ...new Set(
      s.assignments
        .filter((a) => a.accountId === account.id)
        .map((a) => s.roles.find((r) => r.id === a.roleId)?.name)
        .filter((n): n is string => !!n)
    ),
  ]

  return names.join(", ")
}

export function viewerInfo(s: State, account: Account): ViewerInfo {
  const person = personOf(s, account.personId)

  return {
    id: account.id,
    name: accountName(s, account),
    firstName: person?.firstName ?? account.username,
    initials: person ? initials(person) : account.username.slice(0, 2).toUpperCase(),
    username: account.username,
    roleSummary: roleSummary(s, account),
    areas: {
      staff: isStaff(s, account),
      parent: can(s, account, "portal.parent"),
      member: can(s, account, "portal.member"),
    },
  }
}
