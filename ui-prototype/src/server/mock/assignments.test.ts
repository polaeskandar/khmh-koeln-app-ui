/**
 * Assigned groups (polaeskandar/khmh-koeln-app-backend#318): a role holds everywhere in the
 * church or only in the services and stages an account is assigned to. A service assignment
 * covers the service's own roster and all its stages; a stage assignment that stage. Outside its
 * groups an account finds nothing (404, lists leave it out). The demo clock is frozen at Sunday
 * 8 November 2026, 12:08: the Sunday School classes are meeting.
 */
import { describe, expect, test } from "vitest"

import { DEFAULT_ROLES } from "@/lib/domain/policy"
import { ProblemError } from "@/server/errors"
import { getAccountRequests } from "@/server/queries/accounts"
import { getDashboard } from "@/server/queries/dashboard"
import { getAgenda } from "@/server/queries/meetings"
import { listMembers } from "@/server/queries/members"
import { getMemberHome } from "@/server/queries/member"
import { getRoleEditor, getRoleList } from "@/server/queries/roles"
import { getServiceDetail, getStageDetail, listServices } from "@/server/queries/services"
import { getSettings } from "@/server/queries/settings"
import { contextFor } from "@/test/context"

import { approveAccount } from "./commands/accounts"
import { assignGroup, removeAssignment } from "./commands/assignments"
import { openSession } from "./commands/meetings"
import { updatePerson } from "./commands/people"
import { eraseData, recordDataRequest } from "./commands/privacy"
import { createRole, updateRole } from "./commands/roles"
import { createStage, deleteStage } from "./commands/services"
import { isUnassigned } from "./reach"
import { seed } from "./seed"
import { isCurrentOn } from "./selectors"

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
  const user = (email: string) => s.users.find((u) => u.email === email)!
  const service = (name: string) => s.services.find((x) => x.name === name)!
  const stage = (name: string) => s.stages.find((x) => x.name === name)!
  const sundaySchool = service("Sunday School")
  const c1 = stage("1st Class")
  const c3 = stage("3rd Class")
  /** Today's Sunday School session of a class, still waiting for attendance. */
  const sessionOf = (stageId: string) =>
    s.sessions.find((x) => x.stageId === stageId && x.startsAt.startsWith("2026-11-08"))!
  /** Someone in the class today. */
  const memberOf = (stageId: string) =>
    s.persons.find((p) =>
      s.memberships.some(
        (m) => m.personId === p.id && m.stageId === stageId && isCurrentOn(m, "2026-11-08")
      )
    )!
  const fady = user("fady.gerges@example.org")
  return {
    s,
    service,
    stage,
    sundaySchool,
    youth: service("Youth Meeting"),
    c1,
    c3,
    sessionOf,
    memberOf,
    admin: user("mariam.fahmy@example.org"),
    sara: user("sara.wissa@example.org"), // church office: Accounts: Change everywhere
    christine: user("christine.adel@example.org"), // service leader, Sunday School
    daniel: user("daniel.michael@example.org"), // servant, Sunday School › 3rd Class
    mark: user("mark.shenouda@example.org"), // service leader, Youth Meeting
    hoda: user("hoda.farag@example.org"), // parent, and in the Coptic course › Level 1
    fady, // registered as a servant for the Youth Meeting, waiting for approval
    servantRole: DEFAULT_ROLES.find((r) => r.name === "Servant")!,
    approveFady: (assignments?: { serviceId: string; stageId: string | null }[]) =>
      approveAccount(s, user("mariam.fahmy@example.org"), fady.id, {
        as: "servant",
        roleIds: [DEFAULT_ROLES.find((r) => r.name === "Servant")!.id],
        assignments,
      }),
  }
}

describe("the default roles", () => {
  test("Service leader and Servant hold in assigned groups, Administrator and Parent everywhere", () => {
    const t = demo()
    expect(t.s.roles.map((r) => [r.name, r.scope])).toEqual(
      expect.arrayContaining([
        ["Administrator", "church"],
        ["Service leader", "assignedGroups"],
        ["Servant", "assignedGroups"],
        ["Parent", "church"],
        ["Church office", "church"],
      ])
    )
  })
})

describe("a servant assigned to 3rd Class", () => {
  test("sees Sunday School with 3rd Class only", async () => {
    const t = demo()
    const ctx = contextFor(t.s, t.daniel)
    expect((await listServices(ctx)).rows.map((r) => r.name)).toEqual(["Sunday School"])
    const detail = await getServiceDetail(ctx, t.sundaySchool.id)
    expect(detail?.stages.map((x) => x.name)).toEqual(["3rd Class"])
    expect(detail?.can).toEqual({ edit: false, archive: false, structure: false, sessions: false })
    expect(await getStageDetail(ctx, t.sundaySchool.id, t.c3.id)).not.toBeNull()
    expect(await getStageDetail(ctx, t.sundaySchool.id, t.c1.id)).toBeNull()
    expect(await getServiceDetail(ctx, t.youth.id)).toBeNull()
  })

  test("lists only the meetings and members of 3rd Class", async () => {
    const t = demo()
    const ctx = contextFor(t.s, t.daniel)
    const agenda = await getAgenda(ctx, {})
    const groups = new Set(agenda.days.flatMap((d) => d.items.map((i) => i.group)))
    expect([...groups]).toEqual(["3rd Class"])
    const members = await listMembers(ctx)
    expect(members?.rows.length).toBeGreaterThan(10)
    expect(
      members?.rows.every((r) => r.placements.some((p) => p.stage?.name === "3rd Class"))
    ).toBe(true)
    expect(members?.rows.some((r) => r.person.id === t.memberOf(t.c1.id).id)).toBe(false)
  })

  test("takes attendance and edits members in 3rd Class, and finds nothing in 1st Class", () => {
    const t = demo()
    expect(openSession(t.s, t.daniel, t.sessionOf(t.c3.id).id).status).toBe("active")
    expect(statusOf(() => openSession(t.s, t.daniel, t.sessionOf(t.c1.id).id))).toBe(404)
    const own = t.memberOf(t.c3.id)
    updatePerson(t.s, t.daniel, own.id, { firstName: own.firstName, lastName: "Gerges" })
    expect(own.lastName).toBe("Gerges")
    const other = t.memberOf(t.c1.id)
    const edit = () =>
      updatePerson(t.s, t.daniel, other.id, { firstName: other.firstName, lastName: "Gerges" })
    expect(statusOf(edit)).toBe(404)
  })
})

describe("a service leader assigned to Sunday School", () => {
  test("covers every stage of the service, and no other service", async () => {
    const t = demo()
    const ctx = contextFor(t.s, t.christine)
    const detail = await getServiceDetail(ctx, t.sundaySchool.id)
    expect(detail?.stages.map((x) => x.name)).toEqual([
      "Kindergarten",
      "1st Class",
      "2nd Class",
      "3rd Class",
      "4th Class",
      "5th & 6th Class",
    ])
    expect(detail?.can.edit).toBe(true)
    expect(openSession(t.s, t.christine, t.sessionOf(t.c1.id).id).status).toBe("active")
    expect((await listServices(ctx)).rows.map((r) => r.name)).toEqual(["Sunday School"])
    expect(await getServiceDetail(ctx, t.youth.id)).toBeNull()
  })
})

describe("an administrator", () => {
  test("sees every service", async () => {
    const t = demo()
    const rows = (await listServices(contextFor(t.s, t.admin))).rows
    expect(rows).toHaveLength(t.s.services.length)
  })
})

describe("a servant without a group", () => {
  test("sees no service until assigned", async () => {
    const t = demo()
    t.approveFady([])
    expect(isUnassigned(t.s, t.fady)).toBe(true)
    const ctx = contextFor(t.s, t.fady)
    const dashboard = await getDashboard(ctx)
    expect(dashboard.unassigned).toBe(true)
    expect(dashboard.services).toEqual([])
    expect(dashboard.todaySessions).toEqual([])
    expect((await listServices(ctx)).rows).toEqual([])
    expect((await listMembers(ctx))?.rows).toEqual([])

    assignGroup(t.s, t.admin, t.fady.id, { serviceId: t.youth.id, stageId: null })
    expect(isUnassigned(t.s, t.fady)).toBe(false)
    expect((await listServices(ctx)).rows.map((r) => r.name)).toEqual(["Youth Meeting"])
  })
})

describe("assigning", () => {
  test("an administrator assigns anyone anywhere, once per group", () => {
    const t = demo()
    const added = assignGroup(t.s, t.admin, t.daniel.id, {
      serviceId: t.sundaySchool.id,
      stageId: t.c1.id,
    })
    expect(added).toMatchObject({ userId: t.daniel.id, stageId: t.c1.id })
    const again = problemOf(() =>
      assignGroup(t.s, t.admin, t.daniel.id, { serviceId: t.sundaySchool.id, stageId: t.c1.id })
    )
    expect(again?.status).toBe(409)
    expect(again?.detail).toEqual({
      key: "errors.assignments.alreadyAssigned",
      values: { name: "Daniel Michael", where: "Sunday School · 1st Class" },
    })
    expect(
      assignGroup(t.s, t.sara, t.daniel.id, { serviceId: t.youth.id, stageId: null }).serviceId
    ).toBe(t.youth.id)
  })

  test("archived services and stages are refused, as for memberships", () => {
    const t = demo()
    const archivedStage = problemOf(() =>
      assignGroup(t.s, t.admin, t.daniel.id, {
        serviceId: t.sundaySchool.id,
        stageId: t.stage("Toddlers").id,
      })
    )
    expect(archivedStage?.status).toBe(422)
    expect(archivedStage?.fieldErrors).toHaveProperty("stageId")
    const archivedService = problemOf(() =>
      assignGroup(t.s, t.admin, t.daniel.id, {
        serviceId: t.service("Summer Club 2026").id,
        stageId: null,
      })
    )
    expect(archivedService?.fieldErrors).toHaveProperty("serviceId")
  })

  test("a service leader assigns within their service only; a servant nowhere", () => {
    const t = demo()
    const inService = assignGroup(t.s, t.christine, t.daniel.id, {
      serviceId: t.sundaySchool.id,
      stageId: t.c1.id,
    })
    expect(inService.stageId).toBe(t.c1.id)
    const elsewhere = problemOf(() =>
      assignGroup(t.s, t.christine, t.daniel.id, { serviceId: t.youth.id, stageId: null })
    )
    expect(elsewhere?.status).toBe(403)
    expect(elsewhere?.detail).toEqual({ key: "errors.assignments.notAllowed" })
    expect(
      statusOf(() =>
        assignGroup(t.s, t.daniel, t.christine.id, {
          serviceId: t.sundaySchool.id,
          stageId: t.c3.id,
        })
      )
    ).toBe(403)

    const daniels = t.s.assignments.find((a) => a.userId === t.daniel.id && a.stageId === t.c3.id)!
    const marks = t.s.assignments.find((a) => a.userId === t.mark.id)!
    expect(statusOf(() => removeAssignment(t.s, t.christine, marks.id))).toBe(403)
    removeAssignment(t.s, t.christine, daniels.id)
    expect(t.s.assignments).not.toContain(daniels)
    expect(statusOf(() => removeAssignment(t.s, t.admin, daniels.id))).toBe(404)
  })

  test("approving a servant creates the groups chosen with it, or nothing", () => {
    const t = demo()
    const problem = problemOf(() =>
      t.approveFady([{ serviceId: t.sundaySchool.id, stageId: t.stage("Toddlers").id }])
    )
    expect(problem?.status).toBe(422)
    expect(t.fady.approvedAt).toBeNull()
    t.approveFady([{ serviceId: t.youth.id, stageId: null }])
    expect(t.s.assignments.filter((a) => a.userId === t.fady.id)).toMatchObject([
      { serviceId: t.youth.id, stageId: null },
    ])
  })

  test("erasing an account and deleting a stage take their assignments with them", () => {
    const t = demo()
    const request = recordDataRequest(t.s, t.admin, {
      kind: "erasure",
      userId: t.daniel.id,
      requestedBy: "Daniel, in person",
      channel: "in_person",
      receivedOn: "2026-11-05",
    })
    eraseData(t.s, t.admin, request.id, { clearNotes: false })
    expect(t.s.assignments.some((a) => a.userId === t.daniel.id)).toBe(false)

    const choir = createStage(t.s, t.admin, t.sundaySchool.id, { name: "Children's choir" })
    const assigned = assignGroup(t.s, t.admin, t.mark.id, {
      serviceId: t.sundaySchool.id,
      stageId: choir.id,
    })
    deleteStage(t.s, t.admin, choir.id)
    expect(t.s.assignments).not.toContain(assigned)
  })
})

describe("the screens", () => {
  test("staff accounts show their groups; member-only accounts are not listed", async () => {
    const t = demo()
    const settings = await getSettings(contextFor(t.s, t.admin))
    const daniel = settings.users?.find((u) => u.id === t.daniel.id)
    expect(daniel?.groups.map((g) => [g.name, g.canRemove])).toEqual([
      ["Sunday School · 3rd Class", true],
    ])
    expect(daniel?.needsGroups).toBe(true)
    expect(settings.users?.some((u) => u.email === "nevine.boulos@example.org")).toBe(false)
    expect(settings.assignableGroups.map((x) => x.name)).toContain("Youth Meeting")
    expect(settings.assignableGroups.some((x) => x.name === "Summer Club 2026")).toBe(false)
  })

  test("the service page lists its servants, leaders first, with Assign for its leaders", async () => {
    const t = demo()
    const asLeader = await getServiceDetail(contextFor(t.s, t.christine), t.sundaySchool.id)
    expect(asLeader?.servants.rows[0]).toMatchObject({ name: "Christine Adel", leads: true })
    expect(asLeader?.servants.rows.map((r) => r.name)).toContain("Daniel Michael")
    expect(asLeader?.servants.canAssign).toBe(true)
    expect(asLeader?.servants.accounts.map((a) => a.name)).toContain("Mark Shenouda")
    expect(asLeader?.servants.accounts.map((a) => a.name)).not.toContain("Fady Gerges")
  })

  test("a servant sees the leaders and the servants of their own stage, without Assign", async () => {
    const t = demo()
    const detail = await getServiceDetail(contextFor(t.s, t.daniel), t.sundaySchool.id)
    expect(detail?.servants.rows.map((r) => r.name)).toEqual(["Christine Adel", "Daniel Michael"])
    expect(detail?.servants.canAssign).toBe(false)
    expect(detail?.servants.rows.flatMap((r) => r.groups).some((g) => g.canRemove)).toBe(false)
  })

  test("the role editor shows and saves where a role applies", () => {
    const t = demo()
    const created = createRole(t.s, t.admin, {
      name: "Attendance helper",
      permissions: ["services:read", "attendance:read", "attendance:create"],
      scope: "assignedGroups",
    })
    expect(getRoleEditor(contextFor(t.s, t.admin), created.id)?.role?.scope).toBe("assignedGroups")
    updateRole(t.s, t.admin, created.id, {
      name: "Attendance helper",
      permissions: created.permissions,
      scope: "church",
    })
    const row = getRoleList(contextFor(t.s, t.admin))?.rows.find((r) => r.id === created.id)
    expect(row?.scope).toBe("church")
    const plain = createRole(t.s, t.admin, { name: "Door", permissions: ["services:read"] })
    expect(plain.scope).toBe("church")
  })

  test("approving a servant offers the groups, with the service they named", async () => {
    const t = demo()
    const requests = await getAccountRequests(contextFor(t.s, t.admin))
    const fady = requests?.requests.find((r) => r.id === t.fady.id)
    expect(fady?.service?.id).toBe(t.youth.id)
    expect(requests?.groups.some((g) => g.id === t.youth.id)).toBe(true)
  })

  test("the member portal lists the servants of each group, leaders first", async () => {
    const t = demo()
    const home = await getMemberHome(contextFor(t.s, t.hoda))
    const level1 = home.groups.find((g) => g.stage?.name === "Level 1")
    expect(level1?.servants).toEqual(["Irene Wahba", "Youssef Nashed"])
  })
})
