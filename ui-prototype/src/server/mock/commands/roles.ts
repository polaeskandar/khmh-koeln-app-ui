import "server-only"

import { msg } from "@/i18n/message"
import { nameKey } from "@/lib/domain/names"
import { inCatalogOrder, isActiveAccount, isPermission, permissionsOf } from "@/lib/domain/policy"
import { toInstant } from "@/lib/domain/time"
import type { Permission, Role, RoleScope, User, Uuid } from "@/lib/domain/types"
import { invalid, ruleViolation } from "@/server/errors"

import { nowMs } from "../clock"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { holdersOf, roleOf, userOf } from "../selectors"
import type { State } from "../state"

/**
 * Roles are data (RBAC): a name, permissions from the fixed catalog, and where they hold:
 * everywhere in the church, or only in the groups an account is assigned to. Administrator,
 * Service leader, Servant and Parent are where a church starts, and ordinary roles like any
 * other. Two rules protect the church from itself:
 *
 * - Someone active must always be able to change roles (`roles:update`), so access can be
 *   repaired: a change that would leave nobody is refused with `roles.lastRoleManager`.
 * - Deleting a role takes it away from everyone who has it, after the UI said how many.
 */

export type RoleInput = {
  name?: string | null
  permissions: string[]
  /** Where the permissions hold; everywhere when left out, as in the API. */
  scope?: RoleScope
}

/** Every account gets what its roles allow now. Run after any change to roles or role lists. */
export function syncPermissions(s: State) {
  for (const u of s.users) u.permissions = permissionsOf(s.roles, u.roleIds)
}

/** Active accounts that can change roles: they can repair any lockout. */
export function roleManagers(s: State): User[] {
  return s.users.filter((u) => isActiveAccount(u) && u.permissions.includes("roles:update"))
}

/**
 * Applies a change to roles or to who has them, and undoes it when it would leave nobody active
 * who can change roles.
 */
function keepingRoleManagers<T>(s: State, change: () => T): T {
  // Undo restores the same objects, so references held elsewhere stay right.
  const roles = s.roles.map((r) => ({
    r,
    name: r.name,
    permissions: r.permissions,
    scope: r.scope,
    at: r.updatedAt,
  }))
  const roleIds = new Map(s.users.map((u) => [u.id, u.roleIds]))
  const before = roleManagers(s).length
  const result = change()
  syncPermissions(s)
  if (before > 0 && roleManagers(s).length === 0) {
    s.roles = roles.map(({ r, name, permissions, scope, at }) =>
      Object.assign(r, { name, permissions, scope, updatedAt: at })
    )
    for (const u of s.users) u.roleIds = roleIds.get(u.id) ?? u.roleIds
    syncPermissions(s)
    throw ruleViolation(msg("errors.roles.lastRoleManager"))
  }
  return result
}

function checkName(s: State, v: Violations, name: string | null | undefined, exceptId?: Uuid) {
  const clean = v.name("name", name, 80, msg("errors.roles.nameRequired"))
  if (v.has("name")) return clean
  const clash = s.roles.find((r) => r.id !== exceptId && nameKey(r.name) === nameKey(clean))
  if (clash) v.add("name", msg("errors.roles.nameTaken", { name: clash.name }))
  return clean
}

function checkPermissions(v: Violations, permissions: string[]): Permission[] {
  if (permissions.some((p) => !isPermission(p))) {
    v.add("permissions", msg("errors.roles.unknownPermission"))
  }
  return inCatalogOrder(permissions.filter(isPermission))
}

export function createRole(s: State, actor: User, input: RoleInput): Role {
  authorize(actor, "create", "roles", msg("errors.roles.createNotAllowed"))
  const v = new Violations()
  const name = checkName(s, v, input.name)
  const permissions = checkPermissions(v, input.permissions)
  v.throwIfAny()
  const ms = nowMs()
  const role: Role = {
    id: uuidv7(ms),
    name,
    permissions,
    scope: input.scope ?? "church",
    createdAt: toInstant(ms),
    updatedAt: toInstant(ms),
  }
  s.roles.push(role)
  return role
}

/**
 * Renames a role and sets its permissions and where they hold. The change reaches everyone with
 * the role at once.
 */
export function updateRole(s: State, actor: User, roleId: Uuid, input: RoleInput): Role {
  authorize(actor, "update", "roles", msg("errors.roles.updateNotAllowed"))
  const role = found(roleOf(s, roleId), "role")
  const v = new Violations()
  const name = checkName(s, v, input.name, role.id)
  const permissions = checkPermissions(v, input.permissions)
  v.throwIfAny()
  return keepingRoleManagers(s, () => {
    role.name = name
    role.permissions = permissions
    role.scope = input.scope ?? role.scope
    role.updatedAt = toInstant(nowMs())
    return role
  })
}

/** Deletes a role. Everyone who has it loses it (and what it allowed) at once. */
export function deleteRole(s: State, actor: User, roleId: Uuid): { role: Role; holders: number } {
  authorize(actor, "delete", "roles", msg("errors.roles.deleteNotAllowed"))
  const role = found(roleOf(s, roleId), "role")
  const holders = holdersOf(s, role.id).length
  keepingRoleManagers(s, () => {
    s.roles = s.roles.filter((r) => r.id !== role.id)
    for (const u of s.users) u.roleIds = u.roleIds.filter((x) => x !== role.id)
  })
  return { role, holders }
}

/** The account must be approved: requests get their roles when they are approved. */
function approvedAccount(s: State, userId: Uuid): User {
  const user = found(userOf(s, userId), "user")
  if (!user.approvedAt) throw ruleViolation(msg("errors.accounts.notApproved"))
  return user
}

/**
 * Gives an account a role. Where a role for assigned groups holds is up to the account's
 * assignments, given separately.
 */
export function giveRole(s: State, actor: User, userId: Uuid, roleId: string): User {
  authorize(actor, "update", "users", msg("errors.roles.adminOnly"))
  const user = approvedAccount(s, userId)
  const role = roleOf(s, roleId)
  if (!role) throw invalid({ roleId: msg("errors.roles.unknown") })
  if (user.roleIds.includes(role.id)) {
    throw ruleViolation(msg("errors.roles.alreadyHasRole", { name: user.displayName }))
  }
  user.roleIds = [...user.roleIds, role.id]
  syncPermissions(s)
  return user
}

/**
 * Takes a role away from an account; what it allowed is gone with its next request. Removing a
 * role the account doesn't have changes nothing.
 */
export function removeRole(s: State, actor: User, userId: Uuid, roleId: Uuid): User {
  authorize(actor, "update", "users", msg("errors.roles.adminOnly"))
  const user = found(userOf(s, userId), "user")
  if (!user.roleIds.includes(roleId)) return user
  return keepingRoleManagers(s, () => {
    user.roleIds = user.roleIds.filter((x) => x !== roleId)
    return user
  })
}
