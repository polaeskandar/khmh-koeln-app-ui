import { msg } from "@/i18n/message"
import { cleanName, nameKey } from "@/lib/domain/names"
import { OWNERSHIP } from "@/lib/domain/policy"
import {
  isAccessPermission,
  isPermission,
  isResourceType,
  possibleScopes,
  type ResourceRef,
  type ResourceType,
  sameRef,
  scopeTypes,
} from "@/lib/domain/resources"
import {
  cleanDelegation,
  effectivePermissions,
  includingRoles,
  inheritanceLoop,
} from "@/lib/domain/roles"
import type { DelegationRule, Role, RoleAssignment, Uuid } from "@/lib/domain/types"
import { ruleViolation } from "@/server/errors"

import { authorize, roleOf } from "../access"
import { now, nowMs } from "../clock"
import { checkGrant, checkRevoke } from "../delegation"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { exists } from "../resources"
import { accountOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

/** Someone always keeps a protected role for the whole church. */
export function ensureAdministratorRemains(
  s: State,
  change: { removedAssignmentId?: Uuid; removedAccountId?: Uuid }
): void {
  const remains = s.assignments.some(
    (a) =>
      a.id !== change.removedAssignmentId &&
      a.accountId !== change.removedAccountId &&
      a.resource.type === "church" &&
      accountOf(s, a.accountId) !== undefined &&
      roleOf(s, a.roleId)?.protected === true
  )

  if (!remains) {
    throw ruleViolation(msg("errors.access.lastAdministrator"))
  }
}

function record(
  s: State,
  kind: "granted" | "revoked",
  assignment: RoleAssignment,
  actorId: Uuid | null
) {
  s.accessEvents.push({
    id: uuidv7(nowMs()),
    at: now(),
    actorId,
    kind,
    accountId: assignment.accountId,
    roleId: assignment.roleId,
    roleName: roleOf(s, assignment.roleId)?.name ?? "",
    resource: assignment.resource,
  })
}

export function addAssignment(
  s: State,
  input: {
    accountId: Uuid
    role: Role
    resource: ResourceRef
    by: Uuid | null
    origin: RoleAssignment["origin"]
  }
): RoleAssignment {
  if (
    s.assignments.some(
      (a) =>
        a.accountId === input.accountId &&
        a.roleId === input.role.id &&
        sameRef(a.resource, input.resource)
    )
  ) {
    throw ruleViolation(msg("errors.access.alreadyAssigned"))
  }

  const assignment: RoleAssignment = {
    id: uuidv7(nowMs()),
    accountId: input.accountId,
    roleId: input.role.id,
    resource: input.resource,
    origin: input.origin,
    createdAt: now(),
    createdBy: input.by,
  }
  s.assignments.push(assignment)
  record(s, "granted", assignment, input.by)

  return assignment
}

/** The ownership policy: the creator of a resource of an owned type gets its role for it. */
export function grantOwner(s: State, accountId: Uuid, resource: ResourceRef): void {
  const role = roleOf(s, OWNERSHIP[resource.type] ?? "")

  if (role) {
    addAssignment(s, { accountId, role, resource, by: accountId, origin: "owner" })
  }
}

/** Deleted resources take their assignments with them; call after deleting anything. */
export function removeOrphanedAssignments(s: State): void {
  s.assignments = s.assignments.filter((a) => exists(s, a.resource))
}

export function assignRole(
  { state: s, viewer }: Actor,
  accountId: Uuid,
  roleId: Uuid,
  resource: ResourceRef
): RoleAssignment {
  const role = found(roleOf(s, roleId), "role")
  checkGrant(s, viewer, accountId, role, resource)

  return addAssignment(s, { accountId, role, resource, by: viewer.id, origin: "granted" })
}

export function removeAssignment({ state: s, viewer }: Actor, assignmentId: Uuid): void {
  const assignment = found(
    s.assignments.find((a) => a.id === assignmentId),
    "assignment"
  )
  checkRevoke(s, viewer, assignment)
  ensureAdministratorRemains(s, { removedAssignmentId: assignment.id })
  s.assignments.splice(s.assignments.indexOf(assignment), 1)
  record(s, "revoked", assignment, viewer.id)
}

export type RoleInput = {
  name: string
  description: string
  inherits: string[]
  permissions: string[]
  assignableAt: string[]
  delegation: { roleId: string; at: string[] }[]
}

type CleanRole = Pick<
  Role,
  "name" | "description" | "inherits" | "permissions" | "assignableAt" | "delegation"
>

/** Validates a role definition against the others; field errors like the API's 422. */
export function checkRole(s: State, input: RoleInput, current: Role | null): CleanRole {
  const v = new Violations()
  const name = v.name("name", input.name, 80, msg("errors.roles.nameRequired"))
  const description = v.optionalText("description", input.description, 240)

  if (s.roles.some((r) => r.id !== current?.id && nameKey(r.name) === nameKey(name))) {
    v.add("name", msg("errors.roles.nameTaken"))
  }

  const inherits = [...new Set(input.inherits)]
  const parents = inherits.map((id) => roleOf(s, id))

  if (parents.some((r) => r === undefined || r.protected || r.id === current?.id)) {
    v.add("inherits", msg("errors.roles.cannotInherit"))
  }

  const loop = inheritanceLoop(s.roles, current?.id ?? null, inherits)

  if (loop) {
    v.add(
      "inherits",
      msg("errors.roles.loop", { path: loop.map((id) => roleOf(s, id)?.name ?? "?").join(" → ") })
    )
  }

  const permissions = input.permissions.filter(isPermission)
  const draft: Role = {
    id: current?.id ?? "draft",
    name,
    description,
    inherits: loop ? [] : inherits,
    permissions,
    assignableAt: [],
    delegation: [],
    protected: false,
    createdAt: now(),
    updatedAt: now(),
  }
  const others = s.roles.filter((r) => r.id !== draft.id)
  const effective = effectivePermissions([...others, draft], draft.id)

  if (effective.length === 0) {
    v.add("permissions", msg("errors.roles.permissionRequired"))
  }

  const allowedScopes = possibleScopes(effective)
  const assignableAt = scopeTypes().filter((t) => input.assignableAt.includes(t))

  if (assignableAt.length === 0) {
    v.add("assignableAt", msg("errors.roles.scopeRequired"))
  } else if (assignableAt.some((t) => !allowedScopes.includes(t))) {
    v.add("assignableAt", msg("errors.roles.scopeUnused"))
  }

  const delegates = effective.some(isAccessPermission)
  const delegation: DelegationRule[] = delegates
    ? cleanDelegation(
        input.delegation.map((rule) => ({
          roleId: rule.roleId,
          at: rule.at.filter(isResourceType) as ResourceType[],
        }))
      )
    : []

  for (const rule of delegation) {
    const target = roleOf(s, rule.roleId) ?? (rule.roleId === draft.id ? draft : undefined)

    if (!target || target.protected) {
      v.add("delegation", msg("errors.roles.cannotDelegate"))
    } else if (
      rule.at.some(
        (t) => !(rule.roleId === draft.id ? assignableAt : target.assignableAt).includes(t)
      )
    ) {
      v.add("delegation", msg("errors.roles.delegationScope", { role: target.name }))
    }
  }

  v.throwIfAny()

  return {
    name: cleanName(name),
    description,
    inherits,
    permissions: permissions.filter((p, i) => permissions.indexOf(p) === i),
    assignableAt,
    delegation,
  }
}

function touch(s: State) {
  s.rolesVersion += 1
}

export function createRole(actor: Actor, input: RoleInput): Role {
  authorize(actor.state, actor.viewer, "role.create")
  const role: Role = {
    id: uuidv7(nowMs()),
    ...checkRole(actor.state, input, null),
    protected: false,
    createdAt: now(),
    updatedAt: now(),
  }
  actor.state.roles.push(role)
  touch(actor.state)

  return role
}

export function updateRole(actor: Actor, roleId: Uuid, input: RoleInput): Role {
  authorize(actor.state, actor.viewer, "role.update")
  const s = actor.state
  const role = found(roleOf(s, roleId), "role")

  if (role.protected) {
    const v = new Violations()
    const name = v.name("name", input.name, 80, msg("errors.roles.nameRequired"))
    const description = v.optionalText("description", input.description, 240)

    if (s.roles.some((r) => r.id !== role.id && nameKey(r.name) === nameKey(name))) {
      v.add("name", msg("errors.roles.nameTaken"))
    }

    v.throwIfAny()
    Object.assign(role, { name: cleanName(name), description, updatedAt: now() })
    touch(s)

    return role
  }

  Object.assign(role, checkRole(s, input, role), { updatedAt: now() })
  touch(s)

  return role
}

export function deleteRole(actor: Actor, roleId: Uuid): void {
  authorize(actor.state, actor.viewer, "role.delete")
  const s = actor.state
  const role = found(roleOf(s, roleId), "role")

  if (role.protected || Object.values(OWNERSHIP).includes(role.id)) {
    throw ruleViolation(msg("errors.roles.protected", { role: role.name }))
  }

  if (s.assignments.some((a) => a.roleId === role.id)) {
    throw ruleViolation(msg("errors.roles.inUse"))
  }

  const including = includingRoles(s.roles, role.id).filter((r) => r.inherits.includes(role.id))

  if (including.length > 0) {
    throw ruleViolation(
      msg("errors.roles.included", { roles: including.map((r) => r.name).join(", ") })
    )
  }

  for (const other of s.roles) {
    other.delegation = other.delegation.filter((rule) => rule.roleId !== role.id)
  }

  s.roles.splice(s.roles.indexOf(role), 1)
  touch(s)
}
