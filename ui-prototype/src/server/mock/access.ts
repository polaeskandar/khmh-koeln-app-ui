import {
  type Action,
  CHURCH,
  type Permission,
  type ResourceRef,
  type ResourceType,
  refKey,
  sameRef,
} from "@/lib/domain/resources"
import type { Account, Grant, Session, Unit, Uuid } from "@/lib/domain/types"
import { forbidden, notFound, type Thing } from "@/server/errors"

import { today } from "./clock"
import { ancestry, isArchived, unitScope } from "./resources"
import { isCurrentOn, stagesOf, unitsOf } from "./selectors"
import type { State } from "./state"

/**
 * The permission check, the same for every type of resource:
 *
 *   may this member do <action> with <type> at <resource>?
 *     yes for an administrator,
 *     yes when the member has a permission for that type with that action on the resource itself
 *     or on one of its parents (up to the church);
 *     never for a resource that doesn't exist, and only reading inside an archived service or
 *     stage (which itself can still be restored).
 *
 * Reading, updating or deleting something is checked on the thing itself. Creating is checked on
 * the parent the new resource will get, because it doesn't exist yet.
 */

/** What a permission is checked on: a resource, a stage or service without stages, or the church. */
export type Target = ResourceRef | Unit | undefined

const toRef = (target: Target): ResourceRef =>
  target === undefined ? CHURCH : "type" in target ? target : unitScope(target)

export function split(permission: Permission): { type: ResourceType; action: Action } {
  const [type, action] = permission.split(".") as [ResourceType, Action]

  return { type, action }
}

/** Administrators manage access within the whole church, and so may do everything. */
export function isAdministrator(s: State, account: Account): boolean {
  return s.managers.some((m) => m.accountId === account.id && m.resource.type === "church")
}

export function grantsOf(s: State, accountId: Uuid): Grant[] {
  return s.grants.filter((g) => g.accountId === accountId)
}

/** Whether the member may do `action` with resources of `type` at `scope` (or create them there). */
export function holds(
  s: State,
  account: Account,
  type: ResourceType,
  action: Action,
  scope: ResourceRef
): boolean {
  const chain = ancestry(s, scope)

  if (chain === null) {
    return false
  }

  // Inside an archived service or stage only reading is possible; the service or stage itself can
  // still be changed, so that it can be restored.
  if (action !== "read" && isArchived(s, type === scope.type ? chain.slice(1) : chain)) {
    return false
  }

  if (isAdministrator(s, account)) {
    return true
  }

  return grantsOf(s, account.id).some(
    (g) =>
      g.type === type && g.actions.includes(action) && chain.some((r) => sameRef(r, g.resource))
  )
}

export function can(s: State, account: Account, permission: Permission, target?: Target): boolean {
  const { type, action } = split(permission)

  return holds(s, account, type, action, toRef(target))
}

export function authorize(s: State, account: Account, permission: Permission, target?: Target) {
  if (!can(s, account, permission, target)) {
    throw forbidden()
  }
}

/** Has this permission somewhere (for the navigation). */
export function holdsAnywhere(s: State, account: Account, permission: Permission): boolean {
  const { type, action } = split(permission)

  return (
    isAdministrator(s, account) ||
    grantsOf(s, account.id).some((g) => g.type === type && g.actions.includes(action))
  )
}

/** May give and remove permissions within this resource: an administrator, or a manager above. */
export function managesAccess(s: State, account: Account, resource: ResourceRef): boolean {
  const chain = ancestry(s, resource)

  return (
    chain !== null &&
    (isAdministrator(s, account) ||
      s.managers.some(
        (m) => m.accountId === account.id && chain.some((r) => sameRef(r, m.resource))
      ))
  )
}

/** Where the member's management of access starts; the church for an administrator. */
export function managedResources(s: State, account: Account): ResourceRef[] {
  return isAdministrator(s, account)
    ? [CHURCH]
    : s.managers.filter((m) => m.accountId === account.id).map((m) => m.resource)
}

/** Staff use the app itself: administrators and everyone with a permission. */
export function isStaff(s: State, account: Account): boolean {
  return (
    isAdministrator(s, account) ||
    s.grants.some((g) => g.accountId === account.id) ||
    s.managers.some((m) => m.accountId === account.id)
  )
}

/** Parents are linked to at least one child (Accounts › an account › Children). */
export function isParent(s: State, account: Account): boolean {
  return s.guardianships.some((g) => g.accountId === account.id)
}

/** Members belong to a group today. */
export function isMember(s: State, account: Account): boolean {
  const date = today()

  return s.memberships.some((m) => m.personId === account.personId && isCurrentOn(m, date))
}

/** A parent acts for a child only through a link to that child, never through a permission. */
export function canActForChild(s: State, account: Account, personId: Uuid): boolean {
  return s.guardianships.some((g) => g.accountId === account.id && g.childId === personId)
}

/** A stage, or a service without stages, is seen by whoever may read it. */
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

/** Whether the permission counts for the service or one of its stages. */
export function canInService(s: State, account: Account, permission: Permission, serviceId: Uuid) {
  return (
    can(s, account, permission, { type: "service", id: serviceId }) ||
    stagesOf(s, serviceId).some((st) => can(s, account, permission, { type: "stage", id: st.id }))
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
  unit: Unit,
  what: Thing = "service"
): void {
  requireUnit(s, account, unit, what)
  authorize(s, account, permission, unit)
}

/** The stages and services without stages where the permission counts. */
export function unitsWith(s: State, account: Account, permission: Permission): Unit[] {
  if (!holdsAnywhere(s, account, permission)) {
    return []
  }

  return s.services
    .filter((service) => service.archivedAt === null)
    .flatMap((service) => unitsOf(s, service))
    .filter((unit) => can(s, account, permission, unit))
}

export function sessionRef(sessionId: Uuid): ResourceRef {
  return { type: "session", id: sessionId }
}

/** The sessions the member may read, update, … */
export function sessionsWith(s: State, account: Account, action: Action): Session[] {
  if (!holdsAnywhere(s, account, `session.${action}`)) {
    return []
  }

  const admin = isAdministrator(s, account)
  const scopes = new Set(
    grantsOf(s, account.id)
      .filter((g) => g.type === "session" && g.actions.includes(action))
      .map((g) => refKey(g.resource))
  )
  const mayReach = (x: Session) =>
    admin ||
    scopes.has(refKey(CHURCH)) ||
    scopes.has(`session:${x.id}`) ||
    scopes.has(`service:${x.serviceId}`) ||
    (x.stageId !== null && scopes.has(`stage:${x.stageId}`))

  return s.sessions.filter(
    (x) => mayReach(x) && holds(s, account, "session", action, sessionRef(x.id))
  )
}

export function canSeeSession(s: State, account: Account, session: Session): boolean {
  return can(s, account, "session.read", sessionRef(session.id))
}

export function visibleServices(s: State, account: Account) {
  return s.services.filter((service) => canSeeService(s, account, service.id))
}
