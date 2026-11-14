/**
 * Resources and permissions.
 *
 * Every resource has a type, an id and a parent (none for the church). The types and their possible
 * parents are listed once here; the resources themselves are read from the app's data on the
 * server (src/server/mock/resources.ts). Permissions are the same four actions on every type.
 */

export const ACTIONS = ["create", "read", "update", "delete"] as const

export type Action = (typeof ACTIONS)[number]

/**
 * `parents`: the types a resource of this type can sit under.
 * `grouped`: there are many of them under one parent, so the tree shows them in a group
 * ("Lessons", "Sessions") a page at a time.
 */
export type TypeConfig = { parents: readonly string[]; grouped?: boolean }

const TYPES: Record<string, TypeConfig> = {
  church: { parents: [] },
  service: { parents: ["church"] },
  stage: { parents: ["service"] },
  session: { parents: ["stage", "service"], grouped: true },
  lesson: { parents: ["stage", "service"], grouped: true },
  task: { parents: ["lesson"], grouped: true },
}

export type ResourceType = "church" | "service" | "stage" | "session" | "lesson" | "task"

export type ResourceRef = { type: ResourceType; id: string }

export const CHURCH: ResourceRef = { type: "church", id: "church" }

/** `lesson.update`: one action on one type. */
export type Permission = `${Exclude<ResourceType, "church">}.${Action}`

/** Adds a type, e.g. in a test; the permission checks and the screens need nothing else. */
export function registerResourceType(type: string, config: TypeConfig): void {
  TYPES[type] = config
}

export function unregisterResourceType(type: string): void {
  delete TYPES[type]
}

export function isResourceType(value: string): value is ResourceType {
  return value in TYPES
}

export function isGrouped(type: ResourceType): boolean {
  return TYPES[type]?.grouped === true
}

export function parentTypes(type: ResourceType): ResourceType[] {
  return (TYPES[type]?.parents ?? []) as ResourceType[]
}

/** The types that can sit directly under a resource of this type, in the order above. */
export function childTypes(type: ResourceType): ResourceType[] {
  return (Object.keys(TYPES) as ResourceType[]).filter((t) => parentTypes(t).includes(type))
}

/** The type itself and every type that can sit somewhere below it. */
export function typesWithin(type: ResourceType): ResourceType[] {
  const out: ResourceType[] = [type]

  for (let i = 0; i < out.length; i++) {
    for (const child of childTypes(out[i])) {
      if (!out.includes(child)) {
        out.push(child)
      }
    }
  }

  return out
}

/**
 * The actions a permission can hold when given on a resource of type `on` for resources of type
 * `type`: on the resource itself read, update and delete; for a type below it all four, because
 * new ones are created there. The church itself can't be read or changed.
 */
export function actionsFor(on: ResourceType, type: ResourceType): Action[] {
  if (type === on) {
    return on === "church" ? [] : ["read", "update", "delete"]
  }

  return typesWithin(on).includes(type) ? [...ACTIONS] : []
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
