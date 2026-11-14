import {
  CHURCH,
  isPortalPermission,
  type Permission,
  refKey,
  type ResourceRef,
  sameRef,
} from "@/lib/domain/resources"
import {
  type Delegation,
  effectiveDelegation,
  effectivePermissions,
  permissionOrigins,
} from "@/lib/domain/roles"
import type { Account, Role, RoleAssignment, Session, Unit, Uuid } from "@/lib/domain/types"
import { forbidden, notFound, type Thing } from "@/server/errors"

import { ancestry, isArchived, scheduleRef, unitScope } from "./resources"
import { stagesOf, unitsOf } from "./selectors"
import type { State } from "./state"

/**
 * The evaluator. One question, asked everywhere: may this account do this to this resource?
 *
 *   can(account, permission, target)
 *     chain  = target, its authorization parent, …, the church   (unknown resource → deny)
 *     deny when the chain holds an archived resource and the action isn't a read
 *     allow when some assignment of the account
 *       - is on a resource in the chain (its own resource, or one above it), and
 *       - has a role whose effective permissions (its own plus every included role's) hold it.
 *
 * A permission names the type it acts on (`lesson.update` acts on lessons), so a role given for
 * Sunday School reaches Sunday School's lessons, never Youth Gathering's, and never stages unless
 * it holds a stage permission. Create is checked on the parent of the new resource. Administration
 * (accounts, roles, …) and portal entry are checked on the church.
 */

/** What a permission is checked on: a resource, a group (stage or service), or the church. */
export type Target = ResourceRef | Unit | undefined

export type Held = { assignment: RoleAssignment; role: Role }

const toRef = (target: Target): ResourceRef =>
  target === undefined ? CHURCH : "type" in target ? target : unitScope(target)

type RoleCache = {
  version: number
  permissions: Map<Uuid, Set<Permission>>
  delegation: Map<Uuid, Delegation>
}

const caches = new WeakMap<State, RoleCache>()

function cacheOf(s: State): RoleCache {
  const cached = caches.get(s)

  if (cached && cached.version === s.rolesVersion) {
    return cached
  }

  const fresh: RoleCache = {
    version: s.rolesVersion,
    permissions: new Map(),
    delegation: new Map(),
  }
  caches.set(s, fresh)

  return fresh
}

/** The role's effective permissions: its own and every included role's. */
export function effectiveOf(s: State, roleId: Uuid): Set<Permission> {
  const cache = cacheOf(s)
  let found = cache.permissions.get(roleId)

  if (!found) {
    found = new Set(effectivePermissions(s.roles, roleId))
    cache.permissions.set(roleId, found)
  }

  return found
}

/** Which roles holders of this role may give and remove, and where. */
export function delegationOf(s: State, roleId: Uuid): Delegation {
  const cache = cacheOf(s)
  let found = cache.delegation.get(roleId)

  if (!found) {
    found = effectiveDelegation(s.roles, roleId)
    cache.delegation.set(roleId, found)
  }

  return found
}

/** The role that holds a permission directly, for explaining an inherited one. */
export function sourceRolesOf(s: State, roleId: Uuid, permission: Permission): Uuid[] {
  return permissionOrigins(s.roles, roleId).get(permission) ?? []
}

export function roleOf(s: State, roleId: Uuid): Role | undefined {
  return s.roles.find((r) => r.id === roleId)
}

export function heldBy(s: State, accountId: Uuid): Held[] {
  return s.assignments.flatMap((assignment) => {
    const role = assignment.accountId === accountId ? roleOf(s, assignment.roleId) : undefined

    return role ? [{ assignment, role }] : []
  })
}

/** The account's assignments on the chain (the target or above it), whatever their role holds. */
export function reaching(s: State, accountId: Uuid, chain: ResourceRef[]): Held[] {
  return heldBy(s, accountId).filter((h) => chain.some((r) => sameRef(r, h.assignment.resource)))
}

/** The account's assignments that allow the permission on the target. */
export function grantsFor(
  s: State,
  account: Account,
  permission: Permission,
  target?: Target
): Held[] {
  const chain = ancestry(s, toRef(target))

  if (chain === null) {
    return []
  }

  if (!permission.endsWith(".read") && !isPortalPermission(permission) && isArchived(s, chain)) {
    return []
  }

  return reaching(s, account.id, chain).filter((h) => effectiveOf(s, h.role.id).has(permission))
}

export function can(s: State, account: Account, permission: Permission, target?: Target): boolean {
  return grantsFor(s, account, permission, target).length > 0
}

/** Every permission the account holds on the target, through any assignment reaching it. */
export function heldAt(s: State, accountId: Uuid, target: ResourceRef): Set<Permission> {
  const chain = ancestry(s, target)
  const out = new Set<Permission>()

  for (const h of chain ? reaching(s, accountId, chain) : []) {
    effectiveOf(s, h.role.id).forEach((p) => out.add(p))
  }

  return out
}

/** Holds the permission somewhere (for the navigation). */
export function holdsAnywhere(s: State, account: Account, permission: Permission): boolean {
  return heldBy(s, account.id).some((h) => effectiveOf(s, h.role.id).has(permission))
}

export function authorize(s: State, account: Account, permission: Permission, target?: Target) {
  if (!can(s, account, permission, target)) {
    throw forbidden()
  }
}

/** A group (stage, or service without stages) is seen by whoever may read it. */
export function canSeeUnit(s: State, account: Account, unit: Unit): boolean {
  return can(s, account, unit.stageId === null ? "service.read" : "stage.read", unit)
}

/** A service is seen by whoever may read it or one of its stages. */
export function canSeeService(s: State, account: Account, serviceId: Uuid): boolean {
  return (
    can(s, account, "service.read", { type: "service", id: serviceId }) ||
    stagesOf(s, serviceId).some((st) => can(s, account, "stage.read", { type: "stage", id: st.id }))
  )
}

/** Whether the permission counts for the service, one of its stages, or a schedule in it. */
export function canInService(s: State, account: Account, permission: Permission, serviceId: Uuid) {
  const service = s.services.find((x) => x.id === serviceId)

  return (
    can(s, account, permission, { type: "service", id: serviceId }) ||
    (service !== undefined &&
      unitsOf(s, service).some(
        (u) => can(s, account, permission, u) || can(s, account, permission, scheduleRef(s, u))
      ))
  )
}

export function requireUnit(s: State, account: Account, unit: Unit, what: Thing = "service") {
  if (!canSeeUnit(s, account, unit)) {
    throw notFound(what)
  }
}

export function requireIn(
  s: State,
  account: Account,
  permission: Permission,
  target: Unit,
  what: Thing = "service"
): void {
  requireUnit(s, account, target, what)
  authorize(s, account, permission, target)
}

/** The groups (stages, services without stages) where the permission counts. */
export function unitsWith(s: State, account: Account, permission: Permission): Unit[] {
  if (!holdsAnywhere(s, account, permission)) {
    return []
  }

  return s.services
    .filter((service) => service.archivedAt === null)
    .flatMap((service) => unitsOf(s, service))
    .filter((unit) => can(s, account, permission, unit))
}

/** The groups whose schedule allows the permission (planning, confirming a year). */
export function schedulesWith(s: State, account: Account, permission: Permission): Unit[] {
  if (!holdsAnywhere(s, account, permission)) {
    return []
  }

  return s.services
    .filter((service) => service.archivedAt === null)
    .flatMap((service) => unitsOf(s, service))
    .filter((unit) => can(s, account, permission, scheduleRef(s, unit)))
}

export function sessionRef(sessionId: Uuid): ResourceRef {
  return { type: "session", id: sessionId }
}

/** The sessions where the permission counts. */
export function sessionsWith(s: State, account: Account, permission: Permission): Session[] {
  const scopes = new Set(
    heldBy(s, account.id)
      .filter((h) => effectiveOf(s, h.role.id).has(permission))
      .map((h) => refKey(h.assignment.resource))
  )

  if (scopes.size === 0) {
    return []
  }

  const mayReach = (x: Session) =>
    scopes.has(refKey(CHURCH)) ||
    scopes.has(`session:${x.id}`) ||
    scopes.has(`schedule:${x.scheduleId}`) ||
    scopes.has(`service:${x.serviceId}`) ||
    (x.stageId !== null && scopes.has(`stage:${x.stageId}`))

  return s.sessions.filter((x) => mayReach(x) && can(s, account, permission, sessionRef(x.id)))
}

/** A session is seen by whoever may read it. */
export function canSeeSession(s: State, account: Account, session: Session): boolean {
  return can(s, account, "session.read", sessionRef(session.id))
}

export function visibleServices(s: State, account: Account) {
  return s.services.filter((service) => canSeeService(s, account, service.id))
}

/** Staff: someone with a permission beyond portal entry. */
export function isStaff(s: State, account: Account): boolean {
  return heldBy(s, account.id).some((h) =>
    [...effectiveOf(s, h.role.id)].some((p) => !isPortalPermission(p))
  )
}

/**
 * The relationship rule of the parent portal: a parent acts for a child only with the Parent role
 * (portal entry) and an approved parental link to that child. Roles never reach children.
 */
export function canActForChild(s: State, account: Account, personId: Uuid): boolean {
  return (
    can(s, account, "portal.parent") &&
    s.guardianships.some((g) => g.accountId === account.id && g.childId === personId)
  )
}
