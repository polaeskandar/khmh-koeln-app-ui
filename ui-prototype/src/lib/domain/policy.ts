import type {
  Action,
  Group,
  GuardianRelationship,
  Permission,
  Resource,
  RoleScope,
  User,
  Uuid,
} from "./types"

export type { Action, Permission, Resource } from "./types"

/**
 * Who may do what (RBAC). The backend enforces it on every request; the prototype's mock layer
 * enforces it in every server action, and the UI only uses it to hide what a person cannot do.
 *
 * Permissions are fixed by the code: one action (create, read, update, delete) on one resource,
 * 40 in all. Roles are data: a name, some of those permissions and a scope. An account has roles,
 * and may do what any of them allows, where it holds: a `church` role everywhere, an
 * `assignedGroups` role only in the services and stages the account is assigned to (a service
 * covers its own roster and all its stages). The group checks live in the mock layer
 * (`src/server/mock/reach.ts`), which knows the assignments; `can` here only says whether one of
 * the account's roles allows the action somewhere. Users, roles, data requests and parent access
 * have no group: they are checked by permission alone, as before.
 *
 * Which children a parent sees still follows from approved parent access, not from roles: the
 * Parent role only opens the parent portal. A member sees their own record's groups and
 * homework; that needs no role at all, only the link to the record.
 */

/** The actions in the order the role editor shows them: See, Add, Change, Delete. */
export const ACTIONS: Action[] = ["read", "create", "update", "delete"]

/** The resources in the order the role editor lists them: the church's work first, access last. */
export const RESOURCES: Resource[] = [
  "services",
  "stages",
  "sessions",
  "attendance",
  "members",
  "lessons",
  "homework",
  "parentPortal",
  "users",
  "roles",
]

export function permissionOf(action: Action, resource: Resource): Permission {
  return `${resource}:${action}`
}

/** The permission catalog: every action on every resource, in the editor's order. */
export const PERMISSIONS: Permission[] = RESOURCES.flatMap((r) =>
  ACTIONS.map((a) => permissionOf(a, r))
)

const CATALOG = new Set<string>(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return CATALOG.has(value)
}

/** The permissions without duplicates, in catalog order. */
export function inCatalogOrder(permissions: Iterable<Permission>): Permission[] {
  const set = new Set(permissions)
  return PERMISSIONS.filter((p) => set.has(p))
}

/** Rows and columns of the role editor: does the set allow this action on this resource? */
export function allows(permissions: Permission[], action: Action, resource: Resource): boolean {
  return permissions.includes(permissionOf(action, resource))
}

function crud(...resources: Resource[]): Permission[] {
  return resources.flatMap((r) => ACTIONS.map((a) => permissionOf(a, r)))
}

/**
 * The roles a church starts with: the backend's seed (polaeskandar/khmh-koeln-app-backend#130,
 * migration Version20261101141611), with the same ids, names and permissions. Service leader and
 * Servant hold only in the account's assigned groups (backend #318); Administrator and Parent
 * everywhere. They are ordinary roles: the church may rename, change and delete them.
 */
export const DEFAULT_ROLES: {
  id: Uuid
  name: string
  permissions: Permission[]
  scope: RoleScope
}[] = [
  {
    id: "019a3f00-0000-7000-8000-000000000001",
    name: "Administrator",
    scope: "church" as const,
    // Everything but the parent portal (36).
    permissions: crud(
      "users",
      "roles",
      "services",
      "stages",
      "sessions",
      "attendance",
      "members",
      "lessons",
      "homework"
    ),
  },
  {
    id: "019a3f00-0000-7000-8000-000000000002",
    name: "Service leader",
    scope: "assignedGroups" as const,
    // 26
    permissions: [
      "services:read",
      "services:update",
      ...crud("stages", "sessions", "attendance", "members", "lessons", "homework"),
    ],
  },
  {
    id: "019a3f00-0000-7000-8000-000000000003",
    name: "Servant",
    scope: "assignedGroups" as const,
    // 17
    permissions: ["services:read", ...crud("attendance", "members", "lessons", "homework")],
  },
  {
    id: "019a3f00-0000-7000-8000-000000000004",
    name: "Parent",
    scope: "church" as const,
    permissions: ["parentPortal:read"],
  },
].map((r) => ({ ...r, permissions: inCatalogOrder(r.permissions as Permission[]) }))

/** What the roles with these ids allow together, in catalog order. */
export function permissionsOf(
  roles: { id: Uuid; permissions: Permission[] }[],
  roleIds: Uuid[]
): Permission[] {
  return inCatalogOrder(roles.filter((r) => roleIds.includes(r.id)).flatMap((r) => r.permissions))
}

/** An account people can sign in with: approved by the office and not disabled. */
export function isActiveAccount(user: User): boolean {
  return user.approvedAt !== null && user.disabledAt === null
}

/**
 * May the account do this somewhere? Only while it is enabled, and only if one of its roles
 * allows it. For an `assignedGroups` role that is only in the account's groups: what a group
 * allows is `canIn` in the mock layer.
 */
export function can(user: User, action: Action, resource: Resource): boolean {
  return user.disabledAt === null && user.permissions.includes(permissionOf(action, resource))
}

/**
 * Does one of these assignments cover the group? A service assignment covers the service's own
 * roster and all its stages; a stage assignment covers that stage only.
 */
export function covers(assignments: Group[], group: Group): boolean {
  return assignments.some(
    (a) => a.serviceId === group.serviceId && (a.stageId === null || a.stageId === group.stageId)
  )
}

/**
 * Staff: the account's roles let it see the services, which opens the church app (services,
 * meetings, attendance, members, lessons). What it may do there is up to its other permissions.
 */
export function isStaff(user: User): boolean {
  return user.permissions.includes("services:read")
}

/**
 * Parent: the account's roles open the parent portal. Which children it shows still depends on
 * approved parent access.
 */
export function isParent(user: User): boolean {
  return user.permissions.includes("parentPortal:read")
}

/**
 * Member: the account belongs to a member record (someone on a service's roster), so it opens
 * the member portal with that person's own groups and homework. Only the office links an
 * account to a record. Staff and parents can be members too: a servant in the Bible Study, a
 * mother in the Coptic course.
 */
export function isMember(user: User): boolean {
  return user.personId !== null
}

/** Can the user act for this child? Only through an approved guardian relationship. */
export function isGuardianOf(
  user: User,
  personId: Uuid,
  relationships: GuardianRelationship[]
): boolean {
  if (user.disabledAt) return false
  return relationships.some(
    (g) => g.userId === user.id && g.personId === personId && g.status === "approved"
  )
}

/** Can the user report this person's homework? An approved parent, or the member's own account. */
export function canReportFor(
  user: User,
  personId: Uuid,
  relationships: GuardianRelationship[]
): boolean {
  if (user.disabledAt) return false
  return user.personId === personId || isGuardianOf(user, personId, relationships)
}
