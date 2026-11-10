/**
 * Roles and permissions (RBAC): roles are data, a name and permissions from the fixed catalog
 * (an action on a resource), and they hold everywhere in the church or only in the account's
 * assigned groups (`assignments.test.ts` has the groups). The defaults are the
 * backend's seed and ordinary roles. Someone active must always be able to change roles.
 */
import { describe, expect, test } from "vitest"

import { can, DEFAULT_ROLES, isParent, isStaff, PERMISSIONS } from "@/lib/domain/policy"
import { ProblemError } from "@/server/errors"
import { getAccountRequests } from "@/server/queries/accounts"
import { viewerInfo } from "@/server/queries/present"
import { getAssignableRoles, getRoleEditor, getRoleList } from "@/server/queries/roles"
import { getSettings } from "@/server/queries/settings"
import { contextFor } from "@/test/context"

import { eraseData, recordDataRequest } from "./commands/privacy"
import { createRole, deleteRole, giveRole, removeRole, updateRole } from "./commands/roles"
import { seed } from "./seed"
import { roleOf } from "./selectors"

function problemOf(command: () => unknown) {
  try {
    command()
    return null
  } catch (e) {
    if (e instanceof ProblemError) return e.problem
    throw e
  }
}

const statusOf = (command: () => unknown) => problemOf(command)?.status ?? null

function demo() {
  const s = seed()
  const user = (email: string) => s.users.find((x) => x.email === email)!
  const role = (name: string) => s.roles.find((r) => r.name === name)!
  return {
    s,
    admin: user("mariam.fahmy@example.org"),
    leader: user("christine.adel@example.org"),
    daniel: user("daniel.michael@example.org"),
    sara: user("sara.wissa@example.org"),
    hoda: user("hoda.farag@example.org"),
    administrator: role("Administrator"),
    servant: role("Servant"),
    parent: role("Parent"),
    office: role("Church office"),
  }
}

describe("the roles a church starts with", () => {
  test("are the backend's four defaults, with its ids and permission sets", () => {
    const t = demo()
    const defaults = DEFAULT_ROLES.map((d) => roleOf(t.s, d.id)!)
    expect(defaults.map((r) => [r.name, r.permissions.length])).toEqual([
      ["Administrator", 36],
      ["Service leader", 26],
      ["Servant", 17],
      ["Parent", 1],
    ])
    expect(PERMISSIONS).toHaveLength(40)
    expect(t.administrator.permissions.some((p) => p.startsWith("parentPortal:"))).toBe(false)
    expect(t.servant.permissions).toEqual([
      "services:read",
      "attendance:read",
      "attendance:create",
      "attendance:update",
      "attendance:delete",
      "members:read",
      "members:create",
      "members:update",
      "members:delete",
      "lessons:read",
      "lessons:create",
      "lessons:update",
      "lessons:delete",
      "homework:read",
      "homework:create",
      "homework:update",
      "homework:delete",
    ])
    expect(t.parent.permissions).toEqual(["parentPortal:read"])
  })

  test("say what an account may do: a servant takes attendance and prepares lessons", () => {
    const t = demo()
    expect(can(t.daniel, "create", "attendance")).toBe(true)
    expect(can(t.daniel, "create", "lessons")).toBe(true)
    expect(can(t.daniel, "update", "sessions")).toBe(false)
    expect(can(t.daniel, "read", "users")).toBe(false)
    expect(isStaff(t.daniel)).toBe(true)
    expect(isParent(t.hoda) && !isStaff(t.hoda)).toBe(true)
  })

  test("are ordinary: they can be renamed, changed and deleted", () => {
    const t = demo()
    updateRole(t.s, t.admin, t.servant.id, {
      name: "Diener",
      permissions: t.servant.permissions.filter((p) => p !== "members:delete"),
    })
    expect(t.servant.name).toBe("Diener")
    expect(can(t.daniel, "delete", "members")).toBe(false)
    deleteRole(t.s, t.admin, t.parent.id)
    expect(t.hoda.roleIds).toEqual([])
    expect(isParent(t.hoda)).toBe(false)
  })
})

describe("defining roles", () => {
  test("a new role needs a unique name of at most 80 characters", () => {
    const t = demo()
    const errors = (name: string) =>
      problemOf(() => createRole(t.s, t.admin, { name, permissions: [] }))?.fieldErrors
    expect(errors("   ")).toHaveProperty("name")
    expect(errors("x".repeat(81))).toHaveProperty("name")
    // Unique ignoring case and extra spaces, like the backend's name_key.
    expect(errors("  service   LEADER")).toHaveProperty("name")
    const role = createRole(t.s, t.admin, {
      name: "  Attendance   helper ",
      permissions: ["attendance:create", "services:read", "attendance:read"],
    })
    expect(role.name).toBe("Attendance helper")
    // Stored in catalog order, whatever order they came in.
    expect(role.permissions).toEqual(["services:read", "attendance:read", "attendance:create"])
  })

  test("only permissions from the catalog", () => {
    const t = demo()
    const problem = problemOf(() =>
      createRole(t.s, t.admin, { name: "Choir", permissions: ["choir:sing"] })
    )
    expect(problem?.fieldErrors).toHaveProperty("permissions")
  })

  test("adding, changing and deleting roles each need their permission", () => {
    const t = demo()
    expect(statusOf(() => createRole(t.s, t.leader, { name: "Helper", permissions: [] }))).toBe(403)
    expect(
      statusOf(() => updateRole(t.s, t.sara, t.servant.id, { name: "Servant", permissions: [] }))
    ).toBe(403)
    expect(statusOf(() => deleteRole(t.s, t.daniel, t.servant.id))).toBe(403)
  })

  test("a change reaches everyone with the role at once", () => {
    const t = demo()
    expect(can(t.daniel, "update", "lessons")).toBe(true)
    updateRole(t.s, t.admin, t.servant.id, {
      name: "Servant",
      permissions: t.servant.permissions.filter((p) => !p.startsWith("lessons:")),
    })
    expect(can(t.daniel, "update", "lessons")).toBe(false)
    expect(can(t.daniel, "create", "attendance")).toBe(true)
  })

  test("deleting a role takes it away from everyone who has it", () => {
    const t = demo()
    const holders = t.s.users.filter((u) => u.roleIds.includes(t.servant.id)).length
    expect(deleteRole(t.s, t.admin, t.servant.id).holders).toBe(holders)
    expect(t.daniel.roleIds).toEqual([])
    expect(isStaff(t.daniel)).toBe(false)
    expect(roleOf(t.s, t.servant.id)).toBeUndefined()
  })
})

describe("someone must be able to change roles", () => {
  test("Mariam is the only one: her role keeps Roles: Change, stays, and stays hers", () => {
    const t = demo()
    const without = t.administrator.permissions.filter((p) => p !== "roles:update")
    const refused = [
      () =>
        updateRole(t.s, t.admin, t.administrator.id, {
          name: "Administrator",
          permissions: without,
        }),
      () => deleteRole(t.s, t.admin, t.administrator.id),
      () => removeRole(t.s, t.admin, t.admin.id, t.administrator.id),
    ]
    for (const change of refused) {
      expect(problemOf(change)?.detail?.key).toBe("errors.roles.lastRoleManager")
    }
    // Nothing changed.
    expect(t.administrator.permissions).toContain("roles:update")
    expect(t.admin.roleIds).toEqual([t.administrator.id])
    expect(can(t.admin, "update", "roles")).toBe(true)
  })

  test("once someone else can, Mariam may give it up", () => {
    const t = demo()
    giveRole(t.s, t.admin, t.sara.id, t.administrator.id)
    removeRole(t.s, t.admin, t.admin.id, t.administrator.id)
    expect(can(t.admin, "update", "roles")).toBe(false)
    expect(can(t.sara, "update", "roles")).toBe(true)
  })

  test("erasing the only account that can change roles is refused", () => {
    const t = demo()
    const request = recordDataRequest(t.s, t.sara, {
      kind: "erasure",
      userId: t.admin.id,
      requestedBy: "Mariam Fahmy",
      channel: "email",
      receivedOn: "2026-11-06",
    })
    const problem = problemOf(() => eraseData(t.s, t.sara, request.id, { clearNotes: false }))
    expect(problem?.detail?.key).toBe("errors.roles.lastRoleManager")
    expect(t.s.users).toContain(t.admin)
  })
})

describe("giving roles", () => {
  test("needs Accounts: Change, and the role must exist", () => {
    const t = demo()
    expect(statusOf(() => giveRole(t.s, t.leader, t.daniel.id, t.office.id))).toBe(403)
    const unknown = problemOf(() =>
      giveRole(t.s, t.admin, t.daniel.id, "019a3f00-0000-7000-8000-0000000000ff")
    )
    expect(unknown?.fieldErrors).toHaveProperty("roleId")
    expect(statusOf(() => giveRole(t.s, t.admin, t.daniel.id, t.servant.id))).toBe(409)
  })

  test("a second role adds its permissions, everywhere; removing it takes them away", () => {
    const t = demo()
    expect(can(t.daniel, "read", "users")).toBe(false)
    giveRole(t.s, t.admin, t.daniel.id, t.office.id)
    expect(can(t.daniel, "read", "users")).toBe(true)
    expect(can(t.daniel, "create", "attendance")).toBe(true)
    removeRole(t.s, t.admin, t.daniel.id, t.office.id)
    expect(can(t.daniel, "read", "users")).toBe(false)
    // Removing a role the account doesn't have changes nothing.
    removeRole(t.s, t.admin, t.daniel.id, t.office.id)
    expect(t.daniel.roleIds).toEqual([t.servant.id])
  })

  test("the church office gives roles and handles requests, but doesn't define roles", () => {
    const t = demo()
    giveRole(t.s, t.sara, t.daniel.id, t.office.id)
    expect(can(t.sara, "read", "roles")).toBe(false)
    expect(statusOf(() => createRole(t.s, t.sara, { name: "Helper", permissions: [] }))).toBe(403)
  })
})

describe("read models", () => {
  test("the roles list is for accounts that may see roles, by name, with counts", () => {
    const t = demo()
    expect(getRoleList(contextFor(t.s, t.daniel))).toBeNull()
    expect(getRoleList(contextFor(t.s, t.sara))).toBeNull()
    const list = getRoleList(contextFor(t.s, t.admin))!
    expect(list.rows.map((r) => r.name)).toEqual([
      "Administrator",
      "Church office",
      "Lesson preparation",
      "Parent",
      "Servant",
      "Service leader",
    ])
    const servant = list.rows.find((r) => r.name === "Servant")!
    expect(servant.permissions).toBe(17)
    expect(servant.resources).toEqual(["services", "attendance", "members", "lessons", "homework"])
    expect(list.rows.find((r) => r.name === "Lesson preparation")!.holders).toBe(0)
    expect(list.total).toBe(40)
    expect(list.can).toEqual({ create: true, update: true, delete: true })
  })

  test("the role page says when a role is the only way to change roles", () => {
    const t = demo()
    const ctx = contextFor(t.s, t.admin)
    expect(getRoleEditor(contextFor(t.s, t.daniel), t.servant.id)).toBeNull()
    expect(getRoleEditor(ctx, "019a3f00-0000-7000-8000-0000000000ff")).toBeUndefined()
    const admin = getRoleEditor(ctx, t.administrator.id)!
    expect(admin.onlyWayToChangeRoles).toBe(true)
    expect(admin.holders.map((h) => h.name)).toEqual(["Mariam Fahmy"])
    const servant = getRoleEditor(ctx, t.servant.id)!
    expect(servant.onlyWayToChangeRoles).toBe(false)
    expect(servant.holders.at(-1)).toMatchObject({ name: "Samuel Rizk", disabled: true })
    expect(getRoleEditor(ctx, null)!.role).toBeNull()
  })

  test("roles to give say what they open, so dialogs can suggest them", () => {
    const t = demo()
    const roles = getAssignableRoles(contextFor(t.s, t.admin))
    expect(roles.filter((r) => r.parent && !r.staff).map((r) => r.name)).toEqual(["Parent"])
    expect(roles.find((r) => r.name === "Church office")).toMatchObject({
      staff: true,
      parent: false,
    })
  })

  test("viewers carry their permissions and a summary of their roles", () => {
    const t = demo()
    const info = (u: typeof t.admin) => viewerInfo(contextFor(t.s, u), u)
    expect(info(t.admin).roleSummary).toBe("Administrator")
    expect(info(t.sara).roleSummary).toBe("Church office")
    expect(info(t.daniel).permissions).toEqual(t.servant.permissions)
    giveRole(t.s, t.admin, t.daniel.id, t.parent.id)
    expect(info(t.daniel).roleSummary).toBe("Servant +1")
    expect(info(t.hoda).roleSummary).toMatch(/^Parent of /)
  })

  test("staff accounts leave out parents whose roles only open the parent portal", async () => {
    const t = demo()
    const settings = await getSettings(contextFor(t.s, t.sara))
    const names = settings.users!.map((u) => u.name)
    expect(names).toContain("Sara Wissa")
    expect(names).toContain("Daniel Michael")
    expect(names).not.toContain("Hoda Farag")
    expect(settings.roles).toBeNull()
    expect(settings.canChangeAccounts).toBe(true)
    expect((await getSettings(contextFor(t.s, t.daniel))).users).toBeNull()
  })

  test("account requests: Sara sees and decides them, a servant sees nothing", async () => {
    const t = demo()
    expect(await getAccountRequests(contextFor(t.s, t.daniel))).toBeNull()
    const requests = (await getAccountRequests(contextFor(t.s, t.sara)))!
    expect(requests.canDecide).toBe(true)
    expect(requests.roles.map((r) => r.name)).toContain("Parent")
  })
})
