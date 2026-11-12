import { allows, allowsInService, covers, type Grant } from "@/lib/domain/policy"
import type { Account, Permission, Unit, Uuid } from "@/lib/domain/types"
import { forbidden, notFound, type Thing } from "@/server/errors"

import { unitsOf } from "./selectors"
import type { State } from "./state"

export function grantsOf(s: State, accountId: Uuid): Grant[] {
  return s.assignments.flatMap((a) => {
    if (a.accountId !== accountId) {
      return []
    }

    const role = s.roles.find((r) => r.id === a.roleId)

    return role ? [{ permissions: role.permissions, scope: a.scope }] : []
  })
}

export function can(s: State, account: Account, permission: Permission, unit?: Unit): boolean {
  return allows(grantsOf(s, account.id), permission, unit)
}

export function canInService(s: State, account: Account, permission: Permission, serviceId: Uuid) {
  return allowsInService(grantsOf(s, account.id), permission, serviceId)
}

export function authorize(s: State, account: Account, permission: Permission, unit?: Unit): void {
  if (!can(s, account, permission, unit)) {
    throw forbidden()
  }
}

export function canSeeUnit(s: State, account: Account, unit: Unit): boolean {
  return can(s, account, "services.view", unit) || can(s, account, "services.manage")
}

export function canSeeService(s: State, account: Account, serviceId: Uuid): boolean {
  return canInService(s, account, "services.view", serviceId) || can(s, account, "services.manage")
}

export function requireUnit(s: State, account: Account, unit: Unit, what: Thing = "service"): void {
  if (!canSeeUnit(s, account, unit)) {
    throw notFound(what)
  }
}

export function requireIn(
  s: State,
  account: Account,
  permission: Permission,
  unit: Unit,
  what: Thing = "service"
): void {
  requireUnit(s, account, unit, what)
  authorize(s, account, permission, unit)
}

export function unitsWith(s: State, account: Account, permission: Permission): Unit[] {
  const grants = grantsOf(s, account.id).filter((g) => g.permissions.includes(permission))

  if (grants.length === 0) {
    return []
  }

  return s.services
    .filter((service) => service.archivedAt === null)
    .flatMap((service) => unitsOf(s, service))
    .filter((unit) => grants.some((g) => covers(g.scope, unit)))
}

export function visibleServices(s: State, account: Account) {
  return s.services.filter((service) => canSeeService(s, account, service.id))
}

export function isStaff(s: State, account: Account): boolean {
  return grantsOf(s, account.id).some((g) =>
    g.permissions.some((p) => p !== "portal.parent" && p !== "portal.member")
  )
}

export function holdsChurchWide(s: State, account: Account, permission: Permission): boolean {
  return grantsOf(s, account.id).some(
    (g) => g.scope.type === "church" && g.permissions.includes(permission)
  )
}
