import type { CapabilityGroup, PermissionGroup } from "@/lib/domain/resources"
import type {
  DelegationRule,
  Instant,
  LocalDate,
  LocalTime,
  OccasionCategory,
  Permission,
  ResourceType,
  SessionKind,
  SessionStatus,
  Uuid,
} from "@/lib/domain/types"

export type UnitRef = {
  serviceId: Uuid
  stageId: Uuid | null
  serviceName: string
  stageName: string | null
  name: string
  tone: number
}

export type PersonRef = { id: Uuid; name: string; initials: string; lastName: string }

export type AccountRef = { id: Uuid; name: string; username: string }

export type OccasionRef = {
  id: Uuid
  key: string | null
  name: string | null
  category: OccasionCategory
}

export type SessionCard = {
  id: Uuid
  unit: UnitRef
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  status: SessionStatus
  kind: SessionKind
  cancelReason: string | null
  occasion: OccasionRef | null
  changedByHand: boolean
  originalDate: LocalDate | null
  present: number
  roster: number
  canRecord: boolean
  canManage: boolean
}

export type ViewerInfo = {
  id: Uuid
  name: string
  firstName: string
  initials: string
  username: string
  roleSummary: string
  areas: { staff: boolean; parent: boolean; member: boolean }
}

/** A resource as people read it: its name (localized for the church, schedules and sessions). */
export type ResourceLabel = {
  type: ResourceType
  id: string
  name: string
  detail: string | null
}

/** One row of the resource explorer: a resource, or a group of many resources of one type. */
export type ExplorerNode = {
  key: string
  kind: "resource" | "group"
  type: ResourceType
  name: string
  detail: string | null
  count: number | null
  expandable: boolean
  /** The viewer manages access here (and so may open it); otherwise it only leads to such places. */
  manageable: boolean
  /** Roles given directly on this resource. */
  direct: number
}

export type ExplorerPage = { nodes: ExplorerNode[]; next: number | null }

export type AccessPerson = { id: Uuid; name: string; username: string; initials: string }

export type AccessRow = {
  id: Uuid
  person: AccessPerson
  role: { id: Uuid; name: string; protected: boolean }
  origin: "granted" | "owner"
  createdAt: Instant
  createdBy: string | null
  revocable: boolean
  /** Why it can't be removed here, in the viewer's language. */
  locked: string | null
}

export type RoleGroup = {
  role: { id: Uuid; name: string; protected: boolean; description: string | null }
  rows: AccessRow[]
}

export type InheritedGroup = {
  source: ResourceLabel & { href: string | null }
  rows: AccessRow[]
}

export type GrantableRole = {
  id: Uuid
  name: string
  description: string | null
  includes: string[]
  capabilities: CapabilityGroup[]
  scopes: (ResourceLabel & { path: string })[]
}

export type AssignOptions = {
  people: AccessPerson[]
  roles: GrantableRole[]
  unavailable: { id: Uuid; name: string; reason: string }[]
}

export type AccessHistoryEntry = {
  id: Uuid
  at: Instant
  kind: "granted" | "revoked"
  actor: string | null
  person: string
  role: string
}

export type ResourceAccessView = {
  resource: ResourceLabel & { archived: boolean }
  path: (ResourceLabel & { href: string | null })[]
  openHref: string | null
  people: number
  direct: RoleGroup[]
  inherited: InheritedGroup[]
  /** What each role listed here allows on this resource and below it. */
  capabilities: Record<Uuid, CapabilityGroup[]>
  history: AccessHistoryEntry[]
  assign: AssignOptions | null
}

export type AssignmentPreview =
  | { ok: false; problem: string }
  | {
      ok: true
      person: string
      role: string
      scope: string
      gains: CapabilityGroup[]
      already: CapabilityGroup[]
      includes: string[]
      delegation: { role: string; at: ResourceType[] }[]
      overlaps: { role: string; scope: string; relation: "above" | "below" }[]
    }

export type RevocationPreview =
  | { ok: false; problem: string }
  | {
      ok: true
      person: string
      role: string
      scope: string
      loses: CapabilityGroup[]
      keeps: { role: string; scope: string; relation: "above" | "here" | "below" }[]
    }

/** An account's role on one resource, for the account page and lists. */
export type AssignmentChipView = {
  id: Uuid
  role: string
  scope: string
  href: string | null
}

export type RoleOption = { role: { id: Uuid; name: string }; resources: ResourceLabel[] }

export type RoleLevel = "church" | "unit" | "item"

export type RoleSummary = {
  id: Uuid
  name: string
  description: string | null
  protected: boolean
  level: RoleLevel
  includes: { id: Uuid; name: string }[]
  includedBy: { id: Uuid; name: string }[]
  holders: number
  permissions: number
}

export type RoleTreeNode = { id: Uuid; name: string; repeated: boolean; children: RoleTreeNode[] }

export type PermissionState = {
  action: string
  state: "direct" | "inherited" | "none"
  from: string[]
}

export type RoleDetail = RoleSummary & {
  assignableAt: ResourceType[]
  tree: RoleTreeNode
  permissionGroups: { group: PermissionGroup; actions: PermissionState[] }[]
  delegation: "all" | { role: string; at: ResourceType[]; from: string | null }[]
  holderRows: { id: Uuid; person: AccessPerson; scope: string; href: string | null }[]
  ownership: ResourceType[]
  canEdit: boolean
  canDelete: boolean
  /** Why the role can't be deleted now; null when it can. */
  deleteBlocked: string | null
  updatedAt: Instant
}

export type RoleFormRole = {
  id: Uuid
  name: string
  description: string | null
  inherits: Uuid[]
  permissions: Permission[]
  assignableAt: ResourceType[]
  delegation: DelegationRule[]
  protected: boolean
}
