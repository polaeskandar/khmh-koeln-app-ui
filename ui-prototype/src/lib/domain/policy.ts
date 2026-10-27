import type { GuardianRelationship, Role, RoleAssignment, User, Uuid } from "./types"

/**
 * Who may do what. Mirrors the rules agreed for the MVP: the backend will
 * enforce them on every request; the prototype's mock layer enforces them in
 * every server action, and the UI only uses them to hide actions a person
 * cannot take.
 *
 * Roles are scoped: a service leader or servant holds the role in one service,
 * optionally narrowed to one stage (Daniel serves Sunday School · 3rd Class).
 * A stage-scoped role covers that stage only; service-wide things need a
 * service-wide role. Parents have no service roles at all: what they see
 * follows only from approved guardian relationships.
 */
export type Permission =
  // Global
  | "CREATE_SERVICE"
  | "MANAGE_USERS"
  // Scoped to a service (and optionally a stage)
  | "VIEW_SERVICE"
  | "EDIT_SERVICE"
  | "ARCHIVE_SERVICE"
  | "MANAGE_STRUCTURE"
  | "MANAGE_SESSIONS"
  | "RECORD_ATTENDANCE"
  | "REOPEN_SESSION"
  | "MANAGE_MEMBERS"
  | "MANAGE_LESSONS"
  | "MANAGE_HOMEWORK"
  | "VIEW_HOMEWORK_PROGRESS"

type Scoped = Exclude<Permission, "CREATE_SERVICE" | "MANAGE_USERS">

const GLOBAL: Permission[] = ["CREATE_SERVICE", "MANAGE_USERS"]

const SCOPED: Record<Scoped, Role[]> = {
  VIEW_SERVICE: ["service_leader", "servant"],
  EDIT_SERVICE: ["service_leader"],
  ARCHIVE_SERVICE: [],
  MANAGE_STRUCTURE: ["service_leader"],
  MANAGE_SESSIONS: ["service_leader"],
  RECORD_ATTENDANCE: ["service_leader", "servant"],
  REOPEN_SESSION: ["service_leader"],
  MANAGE_MEMBERS: ["service_leader", "servant"],
  MANAGE_LESSONS: ["service_leader", "servant"],
  MANAGE_HOMEWORK: ["service_leader", "servant"],
  VIEW_HOMEWORK_PROGRESS: ["service_leader", "servant"],
}

export function isAdministrator(user: User): boolean {
  return user.roles.some((r) => r.role === "administrator")
}

/** Staff: anyone with an administrator, leader or servant role. Only staff see the church app. */
/** An account people can sign in with: approved by an administrator and not disabled. */
export function isActiveAccount(user: User): boolean {
  return user.approvedAt !== null && user.disabledAt === null
}

export function isStaff(user: User): boolean {
  return user.roles.some((r) => r.role !== "parent")
}

export function isParent(user: User): boolean {
  return user.roles.some((r) => r.role === "parent")
}

/** Does the assignment cover the target? A stage-scoped role covers only its own stage. */
export function covers(
  r: RoleAssignment,
  serviceId: Uuid,
  stageId: Uuid | null | undefined
): boolean {
  if (r.serviceId !== serviceId) return false
  return r.stageId === null || r.stageId === (stageId ?? null)
}

export function can(
  user: User,
  permission: Permission,
  serviceId?: Uuid | null,
  stageId?: Uuid | null
): boolean {
  if (user.disabledAt) return false
  if (isAdministrator(user)) return true
  if (GLOBAL.includes(permission)) return false
  if (permission === "VIEW_SERVICE") return isStaff(user)
  if (!serviceId) return false
  const allowed = SCOPED[permission as Scoped]
  return user.roles.some((r) => allowed.includes(r.role) && covers(r, serviceId, stageId))
}

/** Does the user hold the permission somewhere in the service (in the whole service or one of its stages)? */
export function canInService(user: User, permission: Permission, serviceId: Uuid): boolean {
  if (user.disabledAt) return false
  if (isAdministrator(user)) return true
  if (GLOBAL.includes(permission)) return false
  const allowed = SCOPED[permission as Scoped]
  return user.roles.some((r) => r.serviceId === serviceId && allowed.includes(r.role))
}

/** Does the user hold the permission anywhere at all? */
export function canAnywhere(user: User, permission: Permission): boolean {
  if (user.disabledAt) return false
  if (isAdministrator(user)) return true
  if (GLOBAL.includes(permission)) return false
  const allowed = SCOPED[permission as Scoped]
  return user.roles.some((r) => r.serviceId !== null && allowed.includes(r.role))
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
