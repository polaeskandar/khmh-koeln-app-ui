import "server-only"

import { ACTIONS, can, isActiveAccount, permissionOf, RESOURCES } from "@/lib/domain/policy"
import type { Instant, Permission, Resource, Role, RoleScope, Uuid } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import { roleManagers } from "@/server/mock/commands/roles"
import { holdersOf, roleOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { userRef } from "./present"

/**
 * Read models for roles: the list in Settings, the role page, and the roles to choose from when
 * giving roles. Roles are listed by name; none is special.
 */

const byName = (a: Role, b: Role) => a.name.localeCompare(b.name, "de")

/** The resources a role allows anything on, in the editor's order. */
function resourcesOf(permissions: Permission[]): Resource[] {
  return RESOURCES.filter((r) => ACTIONS.some((a) => permissions.includes(permissionOf(a, r))))
}

export type RoleRow = {
  id: Uuid
  name: string
  permissions: number
  resources: Resource[]
  scope: RoleScope
  /** Accounts that have the role, disabled ones included. */
  holders: number
}

/** The roles list in Settings: for accounts that may see roles, null for everyone else. */
export function getRoleList(ctx: Context) {
  const { state: s, viewer } = ctx
  if (!can(viewer, "read", "roles")) return null
  const rows: RoleRow[] = [...s.roles].sort(byName).map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions.length,
    resources: resourcesOf(r.permissions),
    scope: r.scope,
    holders: holdersOf(s, r.id).length,
  }))
  return {
    rows,
    total: RESOURCES.length * ACTIONS.length,
    can: {
      create: can(viewer, "create", "roles"),
      update: can(viewer, "update", "roles"),
      delete: can(viewer, "delete", "roles"),
    },
  }
}

export type RoleList = NonNullable<ReturnType<typeof getRoleList>>

/** A role to choose when giving roles: what it opens, so the dialogs can suggest the right ones. */
export type AssignableRole = {
  id: Uuid
  name: string
  /** What it allows anything on, in the editor's order. */
  resources: Resource[]
  /** Its permissions open the church app. */
  staff: boolean
  /** Its permissions open the parent portal. */
  parent: boolean
  /** Holds only in the account's assigned groups, so the account needs some. */
  scope: RoleScope
}

export function getAssignableRoles(ctx: Context): AssignableRole[] {
  return [...ctx.state.roles].sort(byName).map((r) => ({
    id: r.id,
    name: r.name,
    resources: resourcesOf(r.permissions),
    staff: r.permissions.includes("services:read"),
    parent: r.permissions.includes("parentPortal:read"),
    scope: r.scope,
  }))
}

export type RoleEditorData = {
  role: {
    id: Uuid
    name: string
    permissions: Permission[]
    scope: RoleScope
    createdAt: Instant
    updatedAt: Instant
  } | null
  holders: { id: Uuid; name: string; initials: string; email: string; disabled: boolean }[]
  /** The other roles' names, to warn about a taken name while typing. */
  otherNames: string[]
  /**
   * Every active account that can change roles gets that through this role, so taking "Roles:
   * Change" out of it would leave nobody; the server refuses that.
   */
  onlyWayToChangeRoles: boolean
  can: { edit: boolean; delete: boolean }
  today: string
}

/**
 * The role page, or a new role when `roleId` is null. Null for accounts that may not see roles
 * (or, for a new role, may not add them); undefined for a role that doesn't exist.
 */
export function getRoleEditor(
  ctx: Context,
  roleId: Uuid | null
): RoleEditorData | null | undefined {
  const { state: s, viewer } = ctx
  if (!can(viewer, "read", "roles")) return null
  if (roleId === null && !can(viewer, "create", "roles")) return null
  const role = roleId === null ? null : roleOf(s, roleId)
  if (role === undefined) return undefined
  const holders = role
    ? holdersOf(s, role.id)
        .map((u) => ({
          ...userRef(u)!,
          email: u.email,
          disabled: !isActiveAccount(u),
        }))
        .sort(
          (a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name, "de")
        )
    : []
  const managers = roleManagers(s)
  const onlyWayToChangeRoles =
    !!role &&
    role.permissions.includes("roles:update") &&
    managers.length > 0 &&
    managers.every((u) =>
      u.roleIds.every(
        (id) => id === role.id || !roleOf(s, id)?.permissions.includes("roles:update")
      )
    )
  return {
    role: role
      ? {
          id: role.id,
          name: role.name,
          permissions: role.permissions,
          scope: role.scope,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        }
      : null,
    holders,
    otherNames: s.roles.filter((r) => r.id !== role?.id).map((r) => r.name),
    onlyWayToChangeRoles,
    can: {
      edit: role ? can(viewer, "update", "roles") : true,
      delete: !!role && can(viewer, "delete", "roles"),
    },
    today: clockToday(),
  }
}
