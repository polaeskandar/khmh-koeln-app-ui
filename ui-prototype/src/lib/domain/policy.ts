import type { Permission, ResourceType } from "./resources"
import type { Role } from "./types"

export const ROLE_IDS = {
  administrator: "019a3f00-0000-7000-8000-000000000001",
  serviceLeader: "019a3f00-0000-7000-8000-000000000002",
  servant: "019a3f00-0000-7000-8000-000000000003",
  parent: "019a3f00-0000-7000-8000-000000000004",
  member: "019a3f00-0000-7000-8000-000000000005",
  lessonEditor: "019a3f00-0000-7000-8000-000000000006",
  sessionHelper: "019a3f00-0000-7000-8000-000000000007",
  churchOffice: "019a3f00-0000-7000-8000-000000000008",
  eventCoordinator: "019a3f00-0000-7000-8000-000000000009",
} as const

/**
 * Ownership policy (board decision: a servant edits only the lessons they write): whoever creates
 * a resource of these types gets this role for it, as an ordinary, removable assignment.
 */
export const OWNERSHIP: Partial<Record<ResourceType, string>> = {
  lesson: ROLE_IDS.lessonEditor,
}

const crud = (type: ResourceType): Permission[] =>
  (["create", "read", "update", "delete"] as const).map((a) => `${type}.${a}` as Permission)

export type RoleSeed = Omit<Role, "createdAt" | "updatedAt">

/**
 * The roles a church starts with. They are data: administrators change them, or add their own, in
 * Roles & permissions. Nothing in the app checks a role by its name or id, except the ownership
 * policy above.
 */
export const DEFAULT_ROLES: RoleSeed[] = [
  {
    id: ROLE_IDS.administrator,
    name: "Administrator",
    description: "Runs the app for the whole church. Can do everything and give every role.",
    protected: true,
    inherits: [],
    permissions: [],
    assignableAt: ["church"],
    delegation: [],
  },
  {
    id: ROLE_IDS.sessionHelper,
    name: "Session helper",
    description: "Helps at sessions and takes attendance.",
    protected: false,
    inherits: [],
    permissions: ["session.read", "session.takeAttendance"],
    assignableAt: ["schedule", "session"],
    delegation: [],
  },
  {
    id: ROLE_IDS.servant,
    name: "Servant",
    description:
      "Serves in a class or service: sees its schedule, takes attendance, writes lessons.",
    protected: false,
    inherits: [ROLE_IDS.sessionHelper],
    permissions: ["service.read", "stage.read", "schedule.read", "lesson.create"],
    assignableAt: ["service", "stage"],
    delegation: [],
  },
  {
    id: ROLE_IDS.lessonEditor,
    name: "Lesson editor",
    description: "Prepares, changes and publishes lessons and their tasks.",
    protected: false,
    inherits: [],
    permissions: [
      "lesson.read",
      "lesson.update",
      "lesson.delete",
      "lesson.publish",
      ...crud("task"),
    ],
    assignableAt: ["lesson", "stage", "service"],
    delegation: [],
  },
  {
    id: ROLE_IDS.serviceLeader,
    name: "Service leader",
    description: "Leads a service: its classes, plans, sessions and lessons, and who serves there.",
    protected: false,
    inherits: [ROLE_IDS.servant, ROLE_IDS.lessonEditor],
    permissions: [
      ...crud("stage"),
      "schedule.plan",
      "schedule.confirm",
      "session.create",
      "session.update",
      "session.delete",
      "session.correctAttendance",
      "access.assign",
      "access.revoke",
    ],
    assignableAt: ["service"],
    delegation: [
      { roleId: ROLE_IDS.servant, at: ["service", "stage"] },
      { roleId: ROLE_IDS.lessonEditor, at: ["lesson"] },
      { roleId: ROLE_IDS.sessionHelper, at: ["schedule", "session"] },
    ],
  },
  {
    id: ROLE_IDS.parent,
    name: "Parent",
    description: "Opens the parent portal. Which children they see comes from Parental access.",
    protected: false,
    inherits: [],
    permissions: ["portal.parent"],
    assignableAt: ["church"],
    delegation: [],
  },
  {
    id: ROLE_IDS.member,
    name: "Member",
    description: "Opens the member portal: their own groups, lessons and tasks.",
    protected: false,
    inherits: [],
    permissions: ["portal.member"],
    assignableAt: ["church"],
    delegation: [],
  },
]
