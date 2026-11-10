import type { Message } from "@/i18n/message"
import { type Action, can, covers, permissionOf, type Resource } from "@/lib/domain/policy"
import type { Group, Permission, RoleScope, StaffAssignment, User, Uuid } from "@/lib/domain/types"
import { forbidden, notFound, type Thing } from "@/server/errors"

import { today } from "./clock"
import { isCurrentOn } from "./selectors"
import type { State } from "./state"

/**
 * Where an account's roles hold (polaeskandar/khmh-koeln-app-backend#318). A `church` role holds
 * everywhere; an `assignedGroups` role only in the groups the account's assignments cover: a
 * service assignment covers the service's own roster and all its stages, a stage assignment that
 * stage. Commands about a group ask `authorizeIn`; read models read `groupView`, the state as the
 * account sees it. Outside its groups an item is not found (404) and lists leave it out; inside,
 * the roles that hold there decide (403). Users, roles, data requests and parent access have no
 * group and are checked by permission alone.
 */

export function assignmentsOf(s: State, userId: Uuid): StaffAssignment[] {
  return s.assignments.filter((a) => a.userId === userId)
}

function grants(s: State, user: User, permission: Permission, scope: RoleScope): boolean {
  if (user.disabledAt) return false
  return s.roles.some(
    (r) => r.scope === scope && user.roleIds.includes(r.id) && r.permissions.includes(permission)
  )
}

/** Does one of the account's roles with this scope allow the action? */
export function roleAllows(
  s: State,
  user: User,
  action: Action,
  resource: Resource,
  scope: RoleScope
): boolean {
  return grants(s, user, permissionOf(action, resource), scope)
}

/** One of the account's church-wide roles allows it: everywhere, assigned or not. */
export function canEverywhere(s: State, user: User, action: Action, resource: Resource): boolean {
  return grants(s, user, permissionOf(action, resource), "church")
}

/**
 * May the account do this in the group? A church-wide role allows it, or a role for the account's
 * groups allows it and one of its assignments covers the group.
 */
export function canIn(
  s: State,
  user: User,
  action: Action,
  resource: Resource,
  group: Group
): boolean {
  const permission = permissionOf(action, resource)
  if (grants(s, user, permission, "church")) return true
  return grants(s, user, permission, "assignedGroups") && covers(assignmentsOf(s, user.id), group)
}

/** May the account do this in the service itself or in one of its stages? */
export function canInService(
  s: State,
  user: User,
  action: Action,
  resource: Resource,
  serviceId: Uuid
): boolean {
  const permission = permissionOf(action, resource)
  if (grants(s, user, permission, "church")) return true
  return (
    grants(s, user, permission, "assignedGroups") &&
    assignmentsOf(s, user.id).some((a) => a.serviceId === serviceId)
  )
}

/**
 * May the account do this in at least one group? The frontend's `can(action, resource)` without a
 * group: a role for assigned groups counts only once the account has an assignment.
 */
export function canSomewhere(s: State, user: User, action: Action, resource: Resource): boolean {
  const permission = permissionOf(action, resource)
  if (grants(s, user, permission, "church")) return true
  return grants(s, user, permission, "assignedGroups") && assignmentsOf(s, user.id).length > 0
}

/** Does the account see the group at all: its roles let it see services there. */
export function seesGroup(s: State, user: User, group: Group): boolean {
  return canIn(s, user, "read", "services", group)
}

/** Does the account see the service: its own roster or one of its stages. */
export function seesService(s: State, user: User, serviceId: Uuid): boolean {
  return canInService(s, user, "read", "services", serviceId)
}

/** A church-wide role lets the account see every service. */
export function seesEverything(s: State, user: User): boolean {
  return canEverywhere(s, user, "read", "services")
}

/**
 * Staff whose roles hold only in assigned groups and who have no assignment yet: they open the
 * staff app but see no group until the church office assigns them.
 */
export function isUnassigned(s: State, user: User): boolean {
  return can(user, "read", "services") && !canSomewhere(s, user, "read", "services")
}

/**
 * Throws 403 unless one of the account's roles allows the action somewhere, 404 when the group is
 * outside the groups the account sees, and 403 when no role allows it in this group.
 */
export function authorizeIn(
  s: State,
  user: User,
  action: Action,
  resource: Resource,
  group: Group,
  what: Thing,
  detail?: Message
): void {
  if (!can(user, action, resource)) throw forbidden(detail)
  if (!seesGroup(s, user, group)) throw notFound(what)
  if (!canIn(s, user, action, resource, group)) throw forbidden(detail)
}

/** Like `authorizeIn`, for the service as a whole (its name, archiving): its own roster's group. */
export function authorizeInService(
  s: State,
  user: User,
  action: Action,
  resource: Resource,
  serviceId: Uuid,
  detail?: Message
): void {
  if (!can(user, action, resource)) throw forbidden(detail)
  if (!seesService(s, user, serviceId)) throw notFound("service")
  if (!canIn(s, user, action, resource, { serviceId, stageId: null })) throw forbidden(detail)
}

const views = new WeakSet<State>()

/**
 * The state as the account sees it: the services, stages, meetings, attendance, members, lessons
 * and homework of its groups. People are those with a current membership in one of the groups,
 * and those who attended or reported homework there, so a meeting's history keeps its names.
 * Accounts, roles, parent access, assignments and data requests are not about a group and stay.
 * A church-wide account sees the state itself.
 */
export function groupView(s: State, user: User): State {
  if (views.has(s) || seesEverything(s, user)) return s
  const assigned = grants(s, user, "services:read", "assignedGroups")
    ? assignmentsOf(s, user.id)
    : []
  const inGroups = (g: Group) => covers(assigned, g)
  const sessions = s.sessions.filter(inGroups)
  const sessionIds = new Set(sessions.map((x) => x.id))
  const attendance = s.attendance.filter((a) => sessionIds.has(a.sessionId))
  const memberships = s.memberships.filter(inGroups)
  const homework = s.homework.filter(inGroups)
  const homeworkIds = new Set(homework.map((h) => h.id))
  const completions = s.completions.filter((c) => homeworkIds.has(c.assignmentId))
  const date = today()
  const personIds = new Set([
    ...memberships.filter((m) => isCurrentOn(m, date)).map((m) => m.personId),
    ...attendance.map((a) => a.personId),
    ...completions.map((c) => c.personId),
  ])
  const view: State = {
    ...s,
    services: s.services.filter((x) => assigned.some((a) => a.serviceId === x.id)),
    stages: s.stages.filter((x) => inGroups({ serviceId: x.serviceId, stageId: x.id })),
    schedules: s.schedules.filter(inGroups),
    sessions,
    events: s.events.filter((e) => sessionIds.has(e.sessionId)),
    attendance,
    memberships,
    persons: s.persons.filter((p) => personIds.has(p.id)),
    lessons: s.lessons.filter(inGroups),
    homework,
    completions,
  }
  views.add(view)
  return view
}

/** Does the person have a current membership in one of the groups the account sees? */
export function seesPerson(s: State, user: User, personId: Uuid): boolean {
  if (seesEverything(s, user)) return true
  const date = today()
  return s.memberships.some(
    (m) => m.personId === personId && isCurrentOn(m, date) && seesGroup(s, user, m)
  )
}
