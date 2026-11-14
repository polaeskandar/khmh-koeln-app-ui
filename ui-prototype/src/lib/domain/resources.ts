/**
 * The resource registry: every type the app authorizes, declared once as configuration.
 *
 * - `parents`: the types a resource of this type can sit under. Each resource has exactly one
 *   authorization parent at a time (a lesson sits under its stage, or under its service when the
 *   service has no stages). Other relationships, such as a lesson linked to a session, never grant
 *   access.
 * - `actions`: what roles can allow on this type. CRUD plus domain actions (publish, take
 *   attendance, confirm a year's plan, …).
 * - `scope`: whether roles can be assigned on resources of this type. Administrative types
 *   (accounts, roles, …) are not scopes; their permissions only count when given for the church.
 * - `listed`: many of them sit under one parent; the explorer groups and pages them.
 *
 * Permissions, where a role can be assigned, the role editor and the resource explorer are all
 * derived from this table. Adding a resource type is a row here, an adapter on the server
 * (src/server/mock/resources.ts) and its labels; the evaluator and the screens don't change.
 */

const CRUD = ["create", "read", "update", "delete"] as const

export type ResourceConfig = {
  parents: readonly string[]
  actions: readonly string[]
  scope: boolean
  listed?: boolean
}

export const RESOURCES = {
  church: { parents: [], actions: [], scope: true },
  service: { parents: ["church"], actions: CRUD, scope: true },
  stage: { parents: ["service"], actions: CRUD, scope: true },
  schedule: { parents: ["stage", "service"], actions: ["read", "plan", "confirm"], scope: true },
  session: {
    parents: ["schedule"],
    actions: [...CRUD, "takeAttendance", "correctAttendance"],
    scope: true,
    listed: true,
  },
  lesson: {
    parents: ["stage", "service"],
    actions: [...CRUD, "publish"],
    scope: true,
    listed: true,
  },
  task: { parents: ["lesson"], actions: CRUD, scope: true, listed: true },
  event: { parents: ["service", "church"], actions: CRUD, scope: true, listed: true },
  account: { parents: ["church"], actions: CRUD, scope: false },
  role: { parents: ["church"], actions: CRUD, scope: false },
  guardianship: { parents: ["church"], actions: ["create", "read", "delete"], scope: false },
  dataRequest: { parents: ["church"], actions: ["create", "read", "update"], scope: false },
} as const satisfies Record<string, ResourceConfig>

export type ResourceType = keyof typeof RESOURCES

type ActionOf<T extends ResourceType> = (typeof RESOURCES)[T]["actions"][number]

export type ResourcePermission = { [T in ResourceType]: `${T}.${ActionOf<T>}` }[ResourceType]

/** Managing access: giving roles and removing them, limited by the role's delegation rules. */
export const ACCESS = ["access.assign", "access.revoke"] as const

/** Entering a portal. Which children a parent sees comes from parental links, never from roles. */
export const PORTALS = ["portal.parent", "portal.member"] as const

export type AccessPermission = (typeof ACCESS)[number]
export type PortalPermission = (typeof PORTALS)[number]
export type Permission = ResourcePermission | AccessPermission | PortalPermission

/** A resource that exists; the church is `{ type: "church", id: "church" }`. */
export type ResourceRef = { type: ResourceType; id: string }

export const CHURCH: ResourceRef = { type: "church", id: "church" }

const registry: Record<string, ResourceConfig> = { ...RESOURCES }

/**
 * Registers a resource type at runtime. The app registers its types above; this exists so a new
 * type can be added without touching the evaluator, and so tests can prove that.
 */
export function registerResourceType(type: string, config: ResourceConfig): void {
  if (registry[type]) {
    throw new Error(`Resource type ${type} is already registered`)
  }

  if (config.parents.some((p) => !registry[p])) {
    throw new Error(`Resource type ${type} has an unknown parent type`)
  }

  registry[type] = config
}

/** Removes a type registered at runtime (tests only); the built-in types can't be removed. */
export function unregisterResourceType(type: string): void {
  if (!(type in RESOURCES)) {
    delete registry[type]
  }
}

export function isResourceType(value: string): value is ResourceType {
  return value in registry
}

/** Read at call time, so a type registered later counts everywhere. */
export function resourceTypes(): ResourceType[] {
  return Object.keys(registry) as ResourceType[]
}

export function configOf(type: ResourceType): ResourceConfig {
  return registry[type]
}

export function actionsOf(type: ResourceType): readonly string[] {
  return registry[type]?.actions ?? []
}

/** The types roles can be assigned on, from the church down. */
export function scopeTypes(): ResourceType[] {
  return resourceTypes().filter((t) => registry[t].scope)
}

/** The types that can sit directly under a resource of this type. */
export function childTypes(type: ResourceType): ResourceType[] {
  return scopeTypes().filter((t) => registry[t].parents.includes(type))
}

export function permissions(): Permission[] {
  return [
    ...resourceTypes().flatMap((type) =>
      actionsOf(type).map((action) => `${type}.${action}` as Permission)
    ),
    ...ACCESS,
    ...PORTALS,
  ]
}

export function isPermission(value: string): value is Permission {
  return permissions().includes(value as Permission)
}

export function isAccessPermission(p: Permission): p is AccessPermission {
  return (ACCESS as readonly string[]).includes(p)
}

export function isPortalPermission(p: Permission): p is PortalPermission {
  return (PORTALS as readonly string[]).includes(p)
}

/** The resource type and action of a resource permission; null for access and portal ones. */
export function splitPermission(p: Permission): { type: ResourceType; action: string } | null {
  if (isAccessPermission(p) || isPortalPermission(p)) {
    return null
  }

  const [type, action] = p.split(".") as [ResourceType, string]

  return { type, action }
}

export function inCatalogOrder(list: Iterable<Permission>): Permission[] {
  const set = new Set(list)

  return permissions().filter((p) => set.has(p))
}

/** `inner` is `outer` or can lie below it. */
export function liesUnder(inner: ResourceType, outer: ResourceType): boolean {
  return (
    inner === outer ||
    (registry[inner]?.parents ?? []).some((p) => liesUnder(p as ResourceType, outer))
  )
}

/**
 * Whether a permission can take effect when given for a resource of type `at`:
 * - `T.create` is checked on the parent of the new resource, so it applies where a parent type of
 *   T is `at` or lies below it;
 * - any other `T.action` applies where T is `at` or lies below it;
 * - managing access applies on every scope; entering a portal only for the church.
 */
export function appliesAt(permission: Permission, at: ResourceType): boolean {
  if (isAccessPermission(permission)) {
    return true
  }

  if (isPortalPermission(permission)) {
    return at === "church"
  }

  const { type, action } = splitPermission(permission)!

  return action === "create"
    ? (registry[type]?.parents ?? []).some((p) => liesUnder(p as ResourceType, at))
    : liesUnder(type, at)
}

/** Takes effect only for the whole church: administration, portals, creating services. */
export function churchOnly(permission: Permission): boolean {
  return !scopeTypes().some((t) => t !== "church" && appliesAt(permission, t))
}

/** The scope types where a role with these permissions can be assigned at all. */
export function possibleScopes(rolePermissions: Iterable<Permission>): ResourceType[] {
  const list = [...rolePermissions]

  if (list.some((p) => !isAccessPermission(p) && churchOnly(p))) {
    return ["church"]
  }

  return scopeTypes().filter((t) => list.some((p) => !isAccessPermission(p) && appliesAt(p, t)))
}

/** How permissions are shown to people: by the type they act on, then access, then portals. */
export type PermissionGroup = ResourceType | "access" | "portal"

export type CapabilityGroup = { group: PermissionGroup; actions: string[] }

export function groupOf(p: Permission): PermissionGroup {
  if (isAccessPermission(p)) {
    return "access"
  }

  if (isPortalPermission(p)) {
    return "portal"
  }

  return splitPermission(p)!.type
}

/** Permissions grouped by what they act on, in catalog order. */
export function groupPermissions(list: Iterable<Permission>): CapabilityGroup[] {
  const out: CapabilityGroup[] = []

  for (const p of inCatalogOrder(list)) {
    const group = groupOf(p)
    const action = p.slice(p.indexOf(".") + 1)
    const last = out.at(-1)

    if (last?.group === group) {
      last.actions.push(action)
    } else {
      out.push({ group, actions: [action] })
    }
  }

  return out
}

/** Whether a type is administration (checked on the church, never a scope). */
export function isAdministration(group: PermissionGroup): boolean {
  return group !== "access" && group !== "portal" && !registry[group]?.scope
}

export function sameRef(a: ResourceRef, b: ResourceRef): boolean {
  return a.type === b.type && a.id === b.id
}

export function refKey(ref: ResourceRef): string {
  return `${ref.type}:${ref.id}`
}

export function parseRefKey(value: unknown): ResourceRef | null {
  if (typeof value !== "string") {
    return null
  }

  const at = value.indexOf(":")
  const type = value.slice(0, at)

  return at > 0 && isResourceType(type) ? { type, id: value.slice(at + 1) } : null
}
