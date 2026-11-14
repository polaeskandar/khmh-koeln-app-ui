import type {
  Action,
  LocalDate,
  LocalTime,
  OccasionCategory,
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
  /** Where the account has access; shown under the name in the menus. */
  access: { administrator: boolean; places: string[] }
  areas: { staff: boolean; parent: boolean; member: boolean }
}

/** A resource as people read it: its name (localized for the church), and its date if it has one. */
export type ResourceLabel = {
  type: ResourceType
  id: string
  name: string
  detail: string | null
}

/** One row of the resource tree: a resource, or the group of many resources of one type. */
export type TreeNode = {
  key: string
  kind: "resource" | "group"
  type: ResourceType
  name: string
  detail: string | null
  count: number | null
  expandable: boolean
  /** The viewer manages access here; otherwise the row only leads to such places. */
  manageable: boolean
  /** Where selecting the row leads. */
  href: string
}

export type TreePage = { nodes: TreeNode[]; next: number | null }

export type AccessPerson = { id: Uuid; name: string; username: string; initials: string }

/** One permission of one member that counts here, given here or on a place above. */
export type AccessLine = {
  id: Uuid
  kind: "grant" | "manager"
  type: ResourceType | null
  actions: Action[]
  /** Null when given right here. */
  from: (ResourceLabel & { href: string | null }) | null
  /** The viewer may change or remove it. */
  editable: boolean
}

export type MemberAccess = { person: AccessPerson; administrator: boolean; lines: AccessLine[] }

/** What the viewer may give here: per type, each action and whether they may give it. */
export type GiveOption = { type: ResourceType; actions: { action: Action; allowed: boolean }[] }

export type AccessView = {
  resource: ResourceLabel & { archived: boolean }
  /** Set when a group is selected ("3rd Class › Lessons"): only that type counts. */
  type: ResourceType | null
  path: (ResourceLabel & { href: string | null })[]
  openHref: string | null
  members: MemberAccess[]
  /** The viewer may give and remove permissions here. */
  canManage: boolean
  /** The viewer is an administrator, who also chooses who manages access. */
  canChooseManagers: boolean
  options: GiveOption[]
  people: AccessPerson[]
}

/** An account's permissions, read-only, for the account page and the accounts list. */
export type AccessSummary = {
  administrator: boolean
  lines: { id: Uuid; text: string; href: string | null }[]
}
