/**
 * The role hierarchy, as pure functions over role definitions (no state, no resources), so the
 * server and the role editor compute the same thing.
 *
 * A role includes the roles it inherits from, and everything they include in turn. Its effective
 * permissions and delegation rules are its own plus those of every included role. Inheritance is a
 * directed acyclic graph: a role may include several roles, and a role may be included by several.
 * The protected role (Administrator) holds every permission there is, can't include or be included,
 * and may assign every role.
 */
import {
  inCatalogOrder,
  isPortalPermission,
  type Permission,
  permissions,
  type ResourceType,
} from "./resources"
import type { DelegationRule, Role, Uuid } from "./types"

export type RoleDefinition = Pick<
  Role,
  "id" | "name" | "inherits" | "permissions" | "delegation" | "protected" | "assignableAt"
>

/** Every permission there is except entering a portal: what a protected role holds. */
export function everyStaffPermission(): Permission[] {
  return permissions().filter((p) => !isPortalPermission(p))
}

function byId<R extends RoleDefinition>(roles: readonly R[]): Map<Uuid, R> {
  return new Map(roles.map((r) => [r.id, r]))
}

/** The roles this role includes, directly or through others; never itself. Safe on cycles. */
export function includedRoles<R extends RoleDefinition>(roles: readonly R[], roleId: Uuid): R[] {
  const index = byId(roles)
  const seen = new Set<Uuid>([roleId])
  const out: R[] = []
  const visit = (id: Uuid) => {
    for (const parentId of index.get(id)?.inherits ?? []) {
      const parent = index.get(parentId)

      if (parent && !seen.has(parentId)) {
        seen.add(parentId)
        out.push(parent)
        visit(parentId)
      }
    }
  }
  visit(roleId)

  return out
}

/** The roles that include this role, directly or through others. */
export function includingRoles<R extends RoleDefinition>(roles: readonly R[], roleId: Uuid): R[] {
  return roles.filter(
    (r) => r.id !== roleId && includedRoles(roles, r.id).some((x) => x.id === roleId)
  )
}

/** The role's permissions with the role(s) each comes from: itself, or an included role. */
export function permissionOrigins(
  roles: readonly RoleDefinition[],
  roleId: Uuid
): Map<Permission, Uuid[]> {
  const role = roles.find((r) => r.id === roleId)
  const out = new Map<Permission, Uuid[]>()

  if (!role) {
    return out
  }

  if (role.protected) {
    for (const p of everyStaffPermission()) {
      out.set(p, [role.id])
    }

    return out
  }

  for (const r of [role, ...includedRoles(roles, roleId)]) {
    for (const p of r.permissions) {
      out.set(p, [...(out.get(p) ?? []), r.id])
    }
  }

  return out
}

export function effectivePermissions(roles: readonly RoleDefinition[], roleId: Uuid): Permission[] {
  return inCatalogOrder(permissionOrigins(roles, roleId).keys())
}

/** "all" for a protected role; otherwise each assignable role with the scope types where. */
export type Delegation = "all" | Map<Uuid, Set<ResourceType>>

export function effectiveDelegation(roles: readonly RoleDefinition[], roleId: Uuid): Delegation {
  const role = roles.find((r) => r.id === roleId)

  if (role?.protected) {
    return "all"
  }

  const out = new Map<Uuid, Set<ResourceType>>()

  for (const r of role ? [role, ...includedRoles(roles, roleId)] : []) {
    for (const rule of r.delegation) {
      const at = out.get(rule.roleId) ?? new Set<ResourceType>()
      rule.at.forEach((t) => at.add(t))
      out.set(rule.roleId, at)
    }
  }

  return out
}

export function delegationAllows(
  delegation: Delegation,
  role: RoleDefinition,
  at: ResourceType
): boolean {
  if (delegation === "all") {
    return true
  }

  return !role.protected && delegation.get(role.id)?.has(at) === true
}

/** Delegation rules as stored: one per role, in role order, without empty ones. */
export function cleanDelegation(rules: DelegationRule[]): DelegationRule[] {
  const merged = new Map<Uuid, Set<ResourceType>>()

  for (const rule of rules) {
    const at = merged.get(rule.roleId) ?? new Set<ResourceType>()
    rule.at.forEach((t) => at.add(t))
    merged.set(rule.roleId, at)
  }

  return [...merged]
    .filter(([, at]) => at.size > 0)
    .map(([roleId, at]) => ({ roleId, at: [...at] }))
}

/**
 * The loop that including `inherits` would create for `roleId`, as role ids from `roleId` back to
 * itself; null when there is none. A role can't include itself, directly or through others.
 */
export function inheritanceLoop(
  roles: readonly RoleDefinition[],
  roleId: Uuid | null,
  inherits: Uuid[]
): Uuid[] | null {
  if (roleId === null) {
    return null
  }

  const index = byId(roles)
  const pathTo = (from: Uuid, seen: Set<Uuid>): Uuid[] | null => {
    if (from === roleId) {
      return [from]
    }

    for (const next of index.get(from)?.inherits ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        const rest = pathTo(next, seen)

        if (rest) {
          return [from, ...rest]
        }
      }
    }

    return null
  }

  for (const parentId of inherits) {
    const path = pathTo(parentId, new Set([parentId]))

    if (path) {
      return [roleId, ...path]
    }
  }

  return null
}
