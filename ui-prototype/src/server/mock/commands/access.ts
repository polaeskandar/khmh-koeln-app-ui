import { msg } from "@/i18n/message"
import { cleanName, nameKey } from "@/lib/domain/names"
import {
  inCatalogOrder,
  isPermission,
  isPortalPermission,
  needsChurchScope,
} from "@/lib/domain/policy"
import type { Account, Permission, Role, Scope, Uuid } from "@/lib/domain/types"
import { forbidden, invalid, ruleViolation } from "@/server/errors"

import { can, holdsChurchWide } from "../access"
import { now, nowMs } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { accountOf, serviceOf, stageOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

type Change = {
  removedAccountId?: Uuid
  removedAssignmentId?: Uuid
  role?: { id: Uuid; permissions: Permission[] }
}

export function ensureAccessManagerRemains(s: State, change: Change): void {
  const permissionsOf = (roleId: Uuid) =>
    change.role?.id === roleId
      ? change.role.permissions
      : (s.roles.find((r) => r.id === roleId)?.permissions ?? [])

  const remains = s.assignments.some((a) => {
    const account = accountOf(s, a.accountId)

    return (
      a.id !== change.removedAssignmentId &&
      a.scope.type === "church" &&
      account !== undefined &&
      account.id !== change.removedAccountId &&
      permissionsOf(a.roleId).includes("access.manage")
    )
  })

  if (!remains) {
    throw ruleViolation(msg("errors.access.lastAccessManager"))
  }
}

export function canGiveRole(s: State, viewer: Account, role: Role): boolean {
  if (role.permissions.every(isPortalPermission)) {
    return can(s, viewer, "accounts.manage") || can(s, viewer, "access.manage")
  }

  return (
    holdsChurchWide(s, viewer, "access.manage") &&
    role.permissions.every((p) => isPortalPermission(p) || holdsChurchWide(s, viewer, p))
  )
}

function checkScope(s: State, scope: Scope) {
  if (scope.type === "church") {
    return
  }

  const service = found(serviceOf(s, scope.serviceId), "service")

  if (scope.type === "stage") {
    const stage = found(stageOf(s, scope.stageId), "stage")

    if (stage.serviceId !== service.id) {
      throw invalid({ scope: msg("errors.access.unknownScope") })
    }
  }
}

export function checkAssignable(
  s: State,
  viewer: Account,
  roleId: Uuid,
  scope: Scope,
  accountId: Uuid | null
): Role {
  const role = found(
    s.roles.find((r) => r.id === roleId),
    "role"
  )

  if (accountId === viewer.id) {
    throw forbidden(msg("errors.access.ownAssignments"))
  }

  if (!canGiveRole(s, viewer, role)) {
    throw forbidden(msg("errors.access.cannotGive", { role: role.name }))
  }

  checkScope(s, scope)

  if (needsChurchScope(role.permissions) && scope.type !== "church") {
    throw invalid({ scope: msg("errors.access.roleNeedsChurch", { role: role.name }) })
  }

  return role
}

function sameScope(a: Scope, b: Scope): boolean {
  if (a.type !== b.type) {
    return false
  }

  if (a.type === "service" && b.type === "service") {
    return a.serviceId === b.serviceId
  }

  return a.type !== "stage" || (b.type === "stage" && a.stageId === b.stageId)
}

export function assignRole(
  { state: s, viewer }: Actor,
  accountId: Uuid,
  roleId: Uuid,
  scope: Scope
) {
  const account = found(accountOf(s, accountId), "account")
  const role = checkAssignable(s, viewer, roleId, scope, account.id)

  if (
    s.assignments.some(
      (a) => a.accountId === account.id && a.roleId === role.id && sameScope(a.scope, scope)
    )
  ) {
    throw ruleViolation(msg("errors.access.alreadyAssigned"))
  }

  const assignment = {
    id: uuidv7(nowMs()),
    accountId: account.id,
    roleId: role.id,
    scope,
    createdAt: now(),
    createdBy: viewer.id,
  }
  s.assignments.push(assignment)

  return assignment
}

export function removeAssignment({ state: s, viewer }: Actor, assignmentId: Uuid) {
  const assignment = found(
    s.assignments.find((a) => a.id === assignmentId),
    "assignment"
  )
  checkAssignable(s, viewer, assignment.roleId, assignment.scope, assignment.accountId)
  ensureAccessManagerRemains(s, { removedAssignmentId: assignment.id })
  s.assignments.splice(s.assignments.indexOf(assignment), 1)
}

function checkRole(
  s: State,
  v: Violations,
  name: string,
  permissions: string[],
  except: Uuid | null
) {
  const clean = v.name("name", name, 80, msg("errors.roles.nameRequired"))

  if (s.roles.some((r) => r.id !== except && nameKey(r.name) === nameKey(clean))) {
    v.add("name", msg("errors.roles.nameTaken"))
  }

  const valid = permissions.filter(isPermission)

  if (valid.length === 0) {
    v.add("permissions", msg("errors.roles.permissionRequired"))
  }

  return { name: cleanName(clean), permissions: inCatalogOrder(valid) }
}

function requireAccessManager({ state: s, viewer }: Actor) {
  if (!holdsChurchWide(s, viewer, "access.manage")) {
    throw forbidden()
  }
}

export function createRole(actor: Actor, name: string, permissions: string[]) {
  requireAccessManager(actor)
  const v = new Violations()
  const clean = checkRole(actor.state, v, name, permissions, null)
  v.throwIfAny()
  const role: Role = { id: uuidv7(nowMs()), ...clean, protected: false, createdAt: now() }
  actor.state.roles.push(role)

  return role
}

export function updateRole(actor: Actor, roleId: Uuid, name: string, permissions: string[]) {
  requireAccessManager(actor)
  const s = actor.state
  const role = found(
    s.roles.find((r) => r.id === roleId),
    "role"
  )
  const v = new Violations()
  const clean = checkRole(s, v, name, permissions, role.id)
  v.throwIfAny()

  if (role.protected && !clean.permissions.includes("access.manage")) {
    throw ruleViolation(msg("errors.roles.protectedKeepsAccess", { role: role.name }))
  }

  if (
    needsChurchScope(clean.permissions) &&
    s.assignments.some((a) => a.roleId === role.id && a.scope.type !== "church")
  ) {
    throw ruleViolation(msg("errors.roles.hasGroupAssignments"))
  }

  ensureAccessManagerRemains(s, { role: { id: role.id, permissions: clean.permissions } })
  role.name = clean.name
  role.permissions = clean.permissions

  return role
}

export function deleteRole(actor: Actor, roleId: Uuid) {
  requireAccessManager(actor)
  const s = actor.state
  const role = found(
    s.roles.find((r) => r.id === roleId),
    "role"
  )

  if (role.protected) {
    throw ruleViolation(msg("errors.roles.protected", { role: role.name }))
  }

  if (s.assignments.some((a) => a.roleId === role.id)) {
    throw ruleViolation(msg("errors.roles.inUse"))
  }

  s.roles.splice(s.roles.indexOf(role), 1)
}
