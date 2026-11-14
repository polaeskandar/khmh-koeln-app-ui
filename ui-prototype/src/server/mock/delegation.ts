import { msg } from "@/i18n/message"
import {
  type AccessPermission,
  appliesAt,
  configOf,
  isPortalPermission,
  type Permission,
  type ResourceRef,
  type ResourceType,
  sameRef,
} from "@/lib/domain/resources"
import { type Delegation, delegationAllows } from "@/lib/domain/roles"
import type { Account, Role, RoleAssignment, Uuid } from "@/lib/domain/types"
import { forbidden, invalid, notFound, ProblemError, ruleViolation } from "@/server/errors"

import {
  can,
  delegationOf,
  effectiveOf,
  type Held,
  heldAt,
  heldBy,
  reaching,
  roleOf,
} from "./access"
import { ancestry, isArchived } from "./resources"
import { accountOf } from "./selectors"
import type { State } from "./state"

/**
 * Delegation: who may give and remove which roles, and where.
 *
 * Managing access is explicit. Editing a resource never implies giving access to it, and holding
 * a role never implies giving it to others. To give role R to account A on resource X, the actor
 *  1. names an existing resource that can be a scope,
 *  2. isn't A (nobody changes their own access),
 *  3. holds `access.assign` through an assignment on X or above it,
 *  4. gives a protected role only if they may assign every role (administrators),
 *  5. has R among that assignment role's delegation rules,
 *  6. gives R only on a type R can be assigned on, and
 *  7. on a type the delegation rule allows,
 *  8. never gives more than they hold on X themselves (R's permissions that take effect on X must
 *     all be the actor's there), and never delegates further than they may delegate,
 *  9. on a resource that isn't archived,
 * 10. to an account that exists, doesn't have R on X yet and doesn't have it on a place above X.
 *
 * Rule 8 is why changing a role's permissions can't silently widen what delegates hand out: if
 * Servant gains a permission a Service leader doesn't hold, Service leaders stop being able to
 * give Servant until an administrator resolves it.
 *
 * Removing an assignment of R on X needs rules 2–5 and 7 with `access.revoke`; someone always
 * keeps a protected role for the whole church.
 */

function managers(s: State, actor: Account, chain: ResourceRef[], permission: AccessPermission) {
  return reaching(s, actor.id, chain).filter((h) => effectiveOf(s, h.role.id).has(permission))
}

/** The delegation rules of all the actor's assignments that manage access on the chain. */
function mergedDelegation(s: State, managing: Held[]): Delegation {
  const out = new Map<Uuid, Set<ResourceType>>()

  for (const h of managing) {
    const d = delegationOf(s, h.role.id)

    if (d === "all") {
      return "all"
    }

    for (const [roleId, at] of d) {
      const set = out.get(roleId) ?? new Set<ResourceType>()
      at.forEach((t) => set.add(t))
      out.set(roleId, set)
    }
  }

  return out
}

/** What the actor may delegate on the resource: "all", or roles with the types where. */
export function delegationAt(
  s: State,
  actor: Account,
  resource: ResourceRef,
  permission: AccessPermission = "access.assign"
): Delegation | null {
  const chain = ancestry(s, resource)
  const managing = chain ? managers(s, actor, chain, permission) : []

  return managing.length > 0 ? mergedDelegation(s, managing) : null
}

/**
 * The permissions of the role the actor would hand out on X without holding them there. Portal
 * entry doesn't count: it opens a person's own portal and is no power over the church's resources.
 */
export function beyondOwn(s: State, actor: Account, role: Role, resource: ResourceRef) {
  const own = heldAt(s, actor.id, resource)

  return [...effectiveOf(s, role.id)].filter(
    (p: Permission) => !isPortalPermission(p) && appliesAt(p, resource.type) && !own.has(p)
  )
}

function delegatesFurther(own: Delegation, role: Role, s: State): boolean {
  const theirs = delegationOf(s, role.id)

  if (own === "all") {
    return false
  }

  if (theirs === "all") {
    return true
  }

  return [...theirs].some(([roleId, at]) =>
    [...at].some((t) => !(own.get(roleId)?.has(t) ?? false))
  )
}

/** Why the actor may not give this role there; null when they may. `accountId` null: anyone. */
export function grantProblem(
  s: State,
  actor: Account,
  accountId: Uuid | null,
  role: Role,
  resource: ResourceRef
): ProblemError | null {
  const chain = ancestry(s, resource)

  if (chain === null || !configOf(resource.type)?.scope) {
    return invalid({ resource: msg("errors.access.unknownPlace") })
  }

  if (accountId === actor.id) {
    return forbidden(msg("errors.access.ownAssignments"))
  }

  const managing = managers(s, actor, chain, "access.assign")

  if (managing.length === 0) {
    return forbidden(msg("errors.access.notHere"))
  }

  const delegation = mergedDelegation(s, managing)

  if (role.protected && delegation !== "all") {
    return forbidden(msg("errors.access.protectedRole", { role: role.name }))
  }

  if (delegation !== "all" && !delegation.has(role.id)) {
    return forbidden(msg("errors.access.notDelegated", { role: role.name }))
  }

  if (!role.assignableAt.includes(resource.type)) {
    return invalid({ resource: msg("errors.access.wrongPlace", { role: role.name }) })
  }

  if (!delegationAllows(delegation, role, resource.type)) {
    return forbidden(msg("errors.access.notDelegatedHere", { role: role.name }))
  }

  if (beyondOwn(s, actor, role, resource).length > 0 || delegatesFurther(delegation, role, s)) {
    return forbidden(msg("errors.access.exceedsOwn", { role: role.name }))
  }

  if (isArchived(s, chain)) {
    return ruleViolation(msg("errors.access.archivedPlace"))
  }

  if (accountId === null) {
    return null
  }

  if (!accountOf(s, accountId)) {
    return notFound("account")
  }

  const same = s.assignments.filter((a) => a.accountId === accountId && a.roleId === role.id)

  if (same.some((a) => sameRef(a.resource, resource))) {
    return ruleViolation(msg("errors.access.alreadyAssigned"))
  }

  if (same.some((a) => chain.slice(1).some((r) => sameRef(r, a.resource)))) {
    return ruleViolation(msg("errors.access.alreadyCovered", { role: role.name }))
  }

  return null
}

export function checkGrant(
  s: State,
  actor: Account,
  accountId: Uuid | null,
  role: Role,
  resource: ResourceRef
): void {
  const problem = grantProblem(s, actor, accountId, role, resource)

  if (problem) {
    throw problem
  }
}

/** Why the actor may not remove this assignment; null when they may. */
export function revokeProblem(
  s: State,
  actor: Account,
  assignment: RoleAssignment
): ProblemError | null {
  const role = roleOf(s, assignment.roleId)
  const chain = ancestry(s, assignment.resource)

  if (!role || chain === null) {
    return notFound("assignment")
  }

  if (assignment.accountId === actor.id) {
    return forbidden(msg("errors.access.ownAssignments"))
  }

  const managing = managers(s, actor, chain, "access.revoke")

  if (managing.length === 0) {
    return forbidden(msg("errors.access.notHere"))
  }

  const delegation = mergedDelegation(s, managing)

  if (role.protected && delegation !== "all") {
    return forbidden(msg("errors.access.protectedRole", { role: role.name }))
  }

  if (!delegationAllows(delegation, role, assignment.resource.type)) {
    return forbidden(msg("errors.access.notDelegated", { role: role.name }))
  }

  return null
}

export function checkRevoke(s: State, actor: Account, assignment: RoleAssignment): void {
  const problem = revokeProblem(s, actor, assignment)

  if (problem) {
    throw problem
  }
}

export function allowed(check: () => void): boolean {
  try {
    check()

    return true
  } catch (error) {
    if (error instanceof ProblemError) {
      return false
    }

    throw error
  }
}

/** The roles the actor may give on this resource. */
export function rolesAt(s: State, actor: Account, resource: ResourceRef): Role[] {
  return s.roles.filter((role) => grantProblem(s, actor, null, role, resource) === null)
}

/** Whether the actor may see and manage access on the resource (give or remove something). */
export function managesAt(s: State, actor: Account, resource: ResourceRef): boolean {
  return (
    delegationAt(s, actor, resource, "access.assign") !== null ||
    delegationAt(s, actor, resource, "access.revoke") !== null
  )
}

/** The resources where the actor's management of access starts: they see these and below. */
export function managementRoots(s: State, actor: Account): ResourceRef[] {
  return heldBy(s, actor.id)
    .filter((h) => {
      const p = effectiveOf(s, h.role.id)

      return p.has("access.assign") || p.has("access.revoke")
    })
    .map((h) => h.assignment.resource)
}

/** Holds access.assign or access.revoke somewhere; cheap enough for the navigation. */
export function managesAnywhere(s: State, actor: Account): boolean {
  return managementRoots(s, actor).length > 0
}

/** The places among the resource and those above it where the actor may give the role. */
export function scopesFor(
  s: State,
  actor: Account,
  role: Role,
  resource: ResourceRef
): ResourceRef[] {
  return (ancestry(s, resource) ?? []).filter((r) => grantProblem(s, actor, null, role, r) === null)
}

/** Roles with the resources among `candidates` where the actor may give them (onboarding). */
export function grantOptions(s: State, actor: Account, candidates: ResourceRef[]) {
  return s.roles
    .map((role) => ({
      role,
      resources: candidates.filter((c) => grantProblem(s, actor, null, role, c) === null),
    }))
    .filter((o) => o.resources.length > 0)
}

/**
 * Moving a resource to another parent is, for authorization, removing it here and creating it
 * there: the actor needs delete on the resource and create on the new parent. Its own assignments
 * move with it; what reaches it from above is read from the new place. So a move never lets
 * anyone take a resource out of a place they don't control.
 */
export function moveProblem(
  s: State,
  actor: Account,
  resource: ResourceRef,
  newParent: ResourceRef
): ProblemError | null {
  const config = configOf(resource.type)

  if (!config || !config.parents.includes(newParent.type) || ancestry(s, newParent) === null) {
    return invalid({ parent: msg("errors.access.unknownPlace") })
  }

  if (
    !can(s, actor, `${resource.type}.delete` as Permission, resource) ||
    !can(s, actor, `${resource.type}.create` as Permission, newParent)
  ) {
    return forbidden()
  }

  return null
}
