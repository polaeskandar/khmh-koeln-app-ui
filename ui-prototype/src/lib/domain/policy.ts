import {
  CHURCH_PERMISSIONS,
  type Permission,
  PORTAL_PERMISSIONS,
  type Scope,
  type Unit,
  UNIT_PERMISSIONS,
  type Uuid,
} from "./types"

export type PermissionGroup =
  "organization" | "schedule" | "attendance" | "learning" | "administration" | "portals"

export const PERMISSION_GROUPS: { group: PermissionGroup; permissions: Permission[] }[] = [
  { group: "organization", permissions: ["services.view", "services.manage", "stages.manage"] },
  { group: "schedule", permissions: ["schedule.manage"] },
  { group: "attendance", permissions: ["attendance.record", "attendance.correct"] },
  { group: "learning", permissions: ["lessons.prepare", "lessons.publish", "tasks.manage"] },
  {
    group: "administration",
    permissions: ["accounts.manage", "access.manage", "guardians.manage", "data.manage"],
  },
  { group: "portals", permissions: ["portal.parent", "portal.member"] },
]

export const PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions)

const CHURCH = new Set<string>(CHURCH_PERMISSIONS)
const UNIT = new Set<string>(UNIT_PERMISSIONS)
const PORTAL = new Set<string>(PORTAL_PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return CHURCH.has(value) || UNIT.has(value) || PORTAL.has(value)
}

export function isUnitPermission(permission: Permission): boolean {
  return UNIT.has(permission)
}

export function isPortalPermission(permission: Permission): boolean {
  return PORTAL.has(permission)
}

export function inCatalogOrder(permissions: Iterable<Permission>): Permission[] {
  const set = new Set(permissions)

  return PERMISSIONS.filter((p) => set.has(p))
}

export function needsChurchScope(permissions: Permission[]): boolean {
  return permissions.some((p) => !isUnitPermission(p))
}

export function covers(scope: Scope, unit: Unit): boolean {
  if (scope.type === "church") {
    return true
  }

  if (scope.type === "service") {
    return scope.serviceId === unit.serviceId
  }

  return scope.stageId === unit.stageId
}

export function coversService(scope: Scope, serviceId: Uuid): boolean {
  return scope.type === "church" || scope.serviceId === serviceId
}

export type Grant = { permissions: Permission[]; scope: Scope }

export function allows(grants: Grant[], permission: Permission, unit?: Unit): boolean {
  return grants.some((grant) => {
    if (!grant.permissions.includes(permission)) {
      return false
    }

    if (grant.scope.type === "church") {
      return true
    }

    return isUnitPermission(permission) && (unit === undefined || covers(grant.scope, unit))
  })
}

export function allowsInService(grants: Grant[], permission: Permission, serviceId: Uuid) {
  return grants.some(
    (grant) => grant.permissions.includes(permission) && coversService(grant.scope, serviceId)
  )
}

export const ROLE_IDS = {
  administrator: "019a3f00-0000-7000-8000-000000000001",
  serviceLeader: "019a3f00-0000-7000-8000-000000000002",
  servant: "019a3f00-0000-7000-8000-000000000003",
  parent: "019a3f00-0000-7000-8000-000000000004",
  member: "019a3f00-0000-7000-8000-000000000005",
} as const

export const DEFAULT_ROLES: {
  id: Uuid
  name: string
  permissions: Permission[]
  protected: boolean
}[] = [
  {
    id: ROLE_IDS.administrator,
    name: "Administrator",
    protected: true,
    permissions: inCatalogOrder([...CHURCH_PERMISSIONS, ...UNIT_PERMISSIONS]),
  },
  {
    id: ROLE_IDS.serviceLeader,
    name: "Service leader",
    protected: false,
    permissions: inCatalogOrder([
      "services.view",
      "stages.manage",
      "schedule.manage",
      "attendance.record",
      "attendance.correct",
      "lessons.prepare",
      "lessons.publish",
      "tasks.manage",
    ]),
  },
  {
    id: ROLE_IDS.servant,
    name: "Servant",
    protected: false,
    permissions: inCatalogOrder([
      "services.view",
      "attendance.record",
      "lessons.prepare",
      "lessons.publish",
      "tasks.manage",
    ]),
  },
  { id: ROLE_IDS.parent, name: "Parent", protected: false, permissions: ["portal.parent"] },
  { id: ROLE_IDS.member, name: "Member", protected: false, permissions: ["portal.member"] },
]

export type PermissionKey = {
  [P in Permission]: P extends `${infer A}.${infer B}` ? `${A}_${B}` : never
}[Permission]

export function permissionKey(permission: Permission): PermissionKey {
  return permission.replace(".", "_") as PermissionKey
}
