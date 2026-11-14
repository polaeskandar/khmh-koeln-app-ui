/**
 * The authorization model, scenario by scenario: two hierarchies (roles include roles; resources
 * sit under resources), one evaluator, explicit delegation. Each test seeds the demo church.
 */
import { afterEach, describe, expect, test } from "vitest"

import { ROLE_IDS } from "@/lib/domain/policy"
import {
  CHURCH,
  type Permission,
  refKey,
  registerResourceType,
  type ResourceRef,
  unregisterResourceType,
} from "@/lib/domain/resources"
import {
  effectivePermissions,
  everyStaffPermission,
  inheritanceLoop,
  permissionOrigins,
} from "@/lib/domain/roles"
import { ProblemError } from "@/server/errors"
import {
  accessTabs,
  explorerChildren,
  explorerStart,
  getResourceAccess,
  previewAssignment,
  previewRevocation,
  searchExplorer,
} from "@/server/queries/access"
import { getShell } from "@/server/queries/shell"
import { accountNamed, contextFor } from "@/test/context"

import { can, canActForChild, canSeeUnit, effectiveOf } from "./access"
import {
  assignRole,
  createRole,
  deleteRole,
  removeAssignment,
  type RoleInput,
  updateRole,
} from "./commands/access"
import { setStageArchived } from "./commands/services"
import { today } from "./clock"
import { grantProblem, moveProblem, rolesAt } from "./delegation"
import { registerAdapter, unregisterAdapter } from "./resources"
import { seed } from "./seed"

const outcome = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      const detail = error.problem.detail?.key
      const field = Object.values(error.problem.fieldErrors ?? {})[0]?.key

      return field ?? detail ?? error.problem.status
    }

    if (error instanceof Error && error.message.includes("NEXT_HTTP_ERROR_FALLBACK;404")) {
      return 404
    }

    throw error
  }

  return "ok"
}

function church() {
  const s = seed("church")
  const ctx = (username: string) => contextFor(s, accountNamed(s, username))
  const account = (username: string) => accountNamed(s, username)
  const service = (name: string): ResourceRef => ({
    type: "service",
    id: s.services.find((x) => x.name === name)!.id,
  })
  const stage = (name: string, serviceName = "Sunday School"): ResourceRef => ({
    type: "stage",
    id: s.stages.find((x) => x.name === name && x.serviceId === service(serviceName).id)!.id,
  })
  const scheduleOfStage = (name: string): ResourceRef => ({
    type: "schedule",
    id: s.schedules.find((x) => x.stageId === stage(name).id)!.id,
  })
  const lesson = (title: string): ResourceRef => ({
    type: "lesson",
    id: s.lessons.find((l) => l.title === title)!.id,
  })
  const event = (name: string): ResourceRef => ({
    type: "event",
    id: s.events.find((e) => e.name === name)!.id,
  })
  const nextSession = (stageName: string): ResourceRef => ({
    type: "session",
    id: s.sessions.find(
      (x) => x.stageId === stage(stageName).id && x.date >= today() && x.status !== "canceled"
    )!.id,
  })
  const assignmentOf = (username: string, roleId: string, resource: ResourceRef) =>
    s.assignments.find(
      (a) =>
        a.accountId === account(username).id &&
        a.roleId === roleId &&
        refKey(a.resource) === refKey(resource)
    )!
  const roleInput = (roleId: string, change: Partial<RoleInput> = {}): RoleInput => {
    const role = s.roles.find((r) => r.id === roleId)!

    return {
      name: role.name,
      description: role.description ?? "",
      inherits: role.inherits,
      permissions: role.permissions,
      assignableAt: role.assignableAt,
      delegation: role.delegation,
      ...change,
    }
  }

  return {
    s,
    ctx,
    account,
    service,
    stage,
    scheduleOfStage,
    lesson,
    event,
    nextSession,
    assignmentOf,
    roleInput,
  }
}

describe("E: the role hierarchy", () => {
  test("a role holds its own permissions and every included role's, and says where each comes from", () => {
    const { s } = church()
    const leader = effectivePermissions(s.roles, ROLE_IDS.serviceLeader)

    expect(leader).toEqual(expect.arrayContaining(["stage.read", "lesson.create"]))
    expect(leader).toContain("session.takeAttendance")
    expect(leader).toContain("lesson.publish")
    expect(leader).not.toContain("account.read")

    const origins = permissionOrigins(s.roles, ROLE_IDS.serviceLeader)
    expect(origins.get("session.takeAttendance")).toEqual([ROLE_IDS.sessionHelper])
    expect(origins.get("lesson.create")).toEqual([ROLE_IDS.servant])
    expect(origins.get("stage.create")).toEqual([ROLE_IDS.serviceLeader])
  })

  test("the protected role holds every staff permission, also of types added later", () => {
    const { s } = church()
    const admin = effectivePermissions(s.roles, ROLE_IDS.administrator)

    expect(new Set(admin)).toEqual(new Set(everyStaffPermission()))
    expect(admin).toContain("event.update")
    expect(admin).toContain("access.assign")
    expect(admin).not.toContain("portal.parent")
  })

  test("changing an included role changes every role that builds on it", () => {
    const { s, ctx, roleInput } = church()
    const mariam = ctx("mariam.fahmy")

    expect(effectiveOf(s, ROLE_IDS.serviceLeader).has("event.read")).toBe(false)
    updateRole(
      mariam,
      ROLE_IDS.sessionHelper,
      roleInput(ROLE_IDS.sessionHelper, {
        permissions: ["session.read", "session.takeAttendance", "session.update"],
      })
    )
    expect(effectiveOf(s, ROLE_IDS.servant).has("session.update")).toBe(true)
  })

  test("inheritance can't loop, can't include a protected role, and a protected role can't be weakened", () => {
    const { s, ctx, roleInput } = church()
    const mariam = ctx("mariam.fahmy")

    expect(inheritanceLoop(s.roles, ROLE_IDS.sessionHelper, [ROLE_IDS.serviceLeader])).toEqual([
      ROLE_IDS.sessionHelper,
      ROLE_IDS.serviceLeader,
      ROLE_IDS.servant,
      ROLE_IDS.sessionHelper,
    ])
    expect(
      outcome(() =>
        updateRole(
          mariam,
          ROLE_IDS.sessionHelper,
          roleInput(ROLE_IDS.sessionHelper, { inherits: [ROLE_IDS.serviceLeader] })
        )
      )
    ).toBe("errors.roles.loop")
    expect(
      outcome(() =>
        createRole(mariam, {
          name: "Deputy",
          description: "",
          inherits: [ROLE_IDS.administrator],
          permissions: [],
          assignableAt: ["church"],
          delegation: [],
        })
      )
    ).toBe("errors.roles.cannotInherit")

    updateRole(mariam, ROLE_IDS.administrator, {
      ...roleInput(ROLE_IDS.administrator),
      name: "Church administrator",
      permissions: ["service.read"],
    })
    expect(s.roles.find((r) => r.id === ROLE_IDS.administrator)!.name).toBe("Church administrator")
    expect(effectiveOf(s, ROLE_IDS.administrator).size).toBe(everyStaffPermission().length)
    expect(outcome(() => deleteRole(mariam, ROLE_IDS.administrator))).toBe("errors.roles.protected")
    expect(outcome(() => deleteRole(mariam, ROLE_IDS.servant))).toBe("errors.roles.inUse")
  })

  test("a role included by others can't be deleted; where it can be given must match its permissions", () => {
    const { ctx } = church()
    const mariam = ctx("mariam.fahmy")
    const coach = createRole(mariam, {
      name: "Coach",
      description: "",
      inherits: [],
      permissions: ["lesson.read"],
      assignableAt: ["stage"],
      delegation: [],
    })
    createRole(mariam, {
      name: "Head coach",
      description: "",
      inherits: [coach.id],
      permissions: [],
      assignableAt: ["stage"],
      delegation: [],
    })

    expect(outcome(() => deleteRole(mariam, coach.id))).toBe("errors.roles.included")
    expect(
      outcome(() =>
        createRole(mariam, {
          name: "Clerk",
          description: "",
          inherits: [],
          permissions: ["account.read"],
          assignableAt: ["service"],
          delegation: [],
        })
      )
    ).toBe("errors.roles.scopeUnused")
  })

  test("only people with role permissions change roles", () => {
    const { ctx, roleInput } = church()

    expect(
      outcome(() =>
        updateRole(ctx("christine.adel"), ROLE_IDS.servant, roleInput(ROLE_IDS.servant))
      )
    ).toBe("errors.forbidden")
    expect(
      outcome(() =>
        createRole(ctx("daniel.michael"), {
          name: "Mine",
          description: "",
          inherits: [],
          permissions: ["lesson.read"],
          assignableAt: ["lesson"],
          delegation: [],
        })
      )
    ).toBe("errors.forbidden")
  })
})

describe("F: the resource hierarchy", () => {
  test("a role given for Sunday School reaches its stages, schedules, sessions and lessons, never Youth Gathering", () => {
    const { s, account, stage, scheduleOfStage, lesson, nextSession } = church()
    const christine = account("christine.adel")

    expect(can(s, christine, "lesson.update", lesson("Joseph forgives his brothers"))).toBe(true)
    expect(can(s, christine, "stage.update", stage("3rd Class"))).toBe(true)
    expect(can(s, christine, "schedule.confirm", scheduleOfStage("3rd Class"))).toBe(true)
    expect(can(s, christine, "session.correctAttendance", nextSession("1st Class"))).toBe(true)
    expect(can(s, christine, "lesson.update", lesson("Prayer in everyday life"))).toBe(false)
    expect(can(s, christine, "lesson.read", lesson("The first eight letters"))).toBe(false)
  })

  test("a permission acts only on its own type: a stage role doesn't change the service", () => {
    const { s, account, service } = church()
    const christine = account("christine.adel")

    expect(can(s, christine, "service.read", service("Sunday School"))).toBe(true)
    expect(can(s, christine, "service.update", service("Sunday School"))).toBe(false)
    expect(can(s, christine, "account.read")).toBe(false)
  })

  test("unknown resources grant nothing, even to an administrator; archived ones are read-only", () => {
    const { s, ctx, account, stage } = church()
    const mariam = account("mariam.fahmy")

    expect(can(s, mariam, "lesson.update", { type: "lesson", id: "missing" })).toBe(false)
    expect(can(s, mariam, "lesson.update", { type: "nothing" as "lesson", id: "x" })).toBe(false)

    setStageArchived(ctx("mariam.fahmy"), stage("4th Class").id, true)
    expect(can(s, account("christine.adel"), "lesson.create", stage("4th Class"))).toBe(false)
    expect(can(s, account("christine.adel"), "stage.read", stage("4th Class"))).toBe(true)
  })

  test("Resource management shows where inherited access comes from", () => {
    const { ctx, lesson } = church()
    const view = getResourceAccess(ctx("mariam.fahmy"), lesson("Joseph forgives his brothers"))!
    const fromSundaySchool = view.inherited.find((g) => g.source.name === "Sunday School")!

    expect(view.direct.map((g) => g.role.name)).toEqual(["Lesson editor"])
    expect(view.direct[0].rows[0]).toMatchObject({ origin: "owner" })
    expect(view.direct[0].rows[0].person.name).toBe("Youssef Kamel")
    expect(fromSundaySchool.rows.map((r) => `${r.person.name} · ${r.role.name}`)).toEqual([
      "Christine Adel · Service leader",
    ])
    expect(view.inherited.some((g) => g.source.name === "3rd Class")).toBe(false)
    expect(view.path.map((p) => p.name)).toEqual(["Whole church", "Sunday School", "3rd Class"])
    expect(view.inherited.flatMap((g) => g.rows).every((r) => !r.revocable)).toBe(true)
  })

  test("moving a resource needs delete where it is and create where it goes", () => {
    const { s, account, stage, service, lesson } = church()

    expect(
      moveProblem(s, account("christine.adel"), lesson("Noah's ark"), stage("3rd Class"))
    ).toBe(null)
    expect(
      outcome(() => {
        throw moveProblem(
          s,
          account("christine.adel"),
          lesson("Noah's ark"),
          service("Youth Gathering")
        )
      })
    ).toBe("errors.forbidden")
    expect(
      outcome(() => {
        throw moveProblem(s, account("daniel.michael"), lesson("Noah's ark"), stage("2nd Class"))
      })
    ).toBe("errors.forbidden")
  })
})

describe("B and H: Christine delegates within Sunday School", () => {
  test("she gives Daniel Servant for 3rd Class; he can then take its attendance", () => {
    const { s, ctx, account, stage, nextSession } = church()
    const daniel = account("daniel.michael")

    expect(can(s, daniel, "session.takeAttendance", nextSession("3rd Class"))).toBe(false)
    expect(
      outcome(() =>
        assignRole(ctx("christine.adel"), daniel.id, ROLE_IDS.servant, stage("3rd Class"))
      )
    ).toBe("ok")
    expect(can(s, daniel, "session.takeAttendance", nextSession("3rd Class"))).toBe(true)
    expect(s.accessEvents.at(-1)).toMatchObject({ kind: "granted", roleName: "Servant" })
  })

  test("she can't give Administrator, Service leader, roles outside Sunday School or at a level her rules don't allow", () => {
    const { ctx, account, stage, service, lesson } = church()
    const christine = ctx("christine.adel")
    const daniel = account("daniel.michael").id
    const give = (roleId: string, where: ResourceRef) =>
      outcome(() => assignRole(christine, daniel, roleId, where))

    expect(give(ROLE_IDS.administrator, service("Sunday School"))).toBe(
      "errors.access.protectedRole"
    )
    expect(give(ROLE_IDS.serviceLeader, service("Sunday School"))).toBe(
      "errors.access.notDelegated"
    )
    expect(give(ROLE_IDS.servant, service("Youth Gathering"))).toBe("errors.access.notHere")
    expect(give(ROLE_IDS.churchOffice, CHURCH)).toBe("errors.access.notHere")
    expect(give(ROLE_IDS.lessonEditor, stage("3rd Class"))).toBe("errors.access.notDelegatedHere")
    expect(give(ROLE_IDS.sessionHelper, stage("3rd Class"))).toBe("errors.access.wrongPlace")
    expect(give(ROLE_IDS.lessonEditor, lesson("God creates the world"))).toBe("ok")
    expect(
      outcome(() =>
        assignRole(christine, account("christine.adel").id, ROLE_IDS.servant, stage("3rd Class"))
      )
    ).toBe("errors.access.ownAssignments")
  })

  test("only the roles she may give are offered, and only places she controls", () => {
    const { s, account, stage } = church()
    const christine = account("christine.adel")

    expect(rolesAt(s, christine, stage("3rd Class")).map((r) => r.name)).toEqual(["Servant"])
    expect(rolesAt(s, christine, CHURCH)).toEqual([])
  })

  test("a role she may give stops being givable once it allows more than she holds", () => {
    const { ctx, account, service, roleInput } = church()
    const mariam = ctx("mariam.fahmy")
    const christine = ctx("christine.adel")
    const helper = createRole(mariam, {
      name: "Service aide",
      description: "",
      inherits: [],
      permissions: ["service.read"],
      assignableAt: ["service"],
      delegation: [],
    })
    updateRole(
      mariam,
      ROLE_IDS.serviceLeader,
      roleInput(ROLE_IDS.serviceLeader, {
        delegation: [
          ...roleInput(ROLE_IDS.serviceLeader).delegation,
          { roleId: helper.id, at: ["service"] },
        ],
      })
    )
    expect(
      outcome(() =>
        assignRole(christine, account("daniel.michael").id, helper.id, service("Sunday School"))
      )
    ).toBe("ok")

    updateRole(mariam, helper.id, {
      name: "Service aide",
      description: "",
      inherits: [],
      permissions: ["service.read", "service.update"],
      assignableAt: ["service"],
      delegation: [],
    })
    expect(
      outcome(() =>
        assignRole(christine, account("george.nashed").id, helper.id, service("Sunday School"))
      )
    ).toBe("errors.access.exceedsOwn")
  })

  test("she can't hand out a role that delegates further than she may", () => {
    const { ctx, account, service, roleInput } = church()
    const mariam = ctx("mariam.fahmy")
    const deputy = createRole(mariam, {
      name: "Deputy leader",
      description: "",
      inherits: [ROLE_IDS.servant],
      permissions: ["access.assign"],
      assignableAt: ["service"],
      delegation: [{ roleId: ROLE_IDS.eventCoordinator, at: ["service"] }],
    })
    updateRole(
      mariam,
      ROLE_IDS.serviceLeader,
      roleInput(ROLE_IDS.serviceLeader, {
        delegation: [
          ...roleInput(ROLE_IDS.serviceLeader).delegation,
          { roleId: deputy.id, at: ["service"] },
        ],
      })
    )

    expect(
      outcome(() =>
        assignRole(
          ctx("christine.adel"),
          account("daniel.michael").id,
          deputy.id,
          service("Sunday School")
        )
      )
    ).toBe("errors.access.exceedsOwn")
  })

  test("a role already given for a broader place isn't given again below it", () => {
    const { ctx, account, service, stage } = church()
    const christine = ctx("christine.adel")
    const daniel = account("daniel.michael").id

    assignRole(christine, daniel, ROLE_IDS.servant, service("Sunday School"))
    expect(outcome(() => assignRole(christine, daniel, ROLE_IDS.servant, stage("3rd Class")))).toBe(
      "errors.access.alreadyCovered"
    )
  })

  test("invalid places are refused before anything else", () => {
    const { ctx, account } = church()
    const mariam = ctx("mariam.fahmy")
    const daniel = account("daniel.michael").id

    expect(
      outcome(() => assignRole(mariam, daniel, ROLE_IDS.servant, { type: "lesson", id: "missing" }))
    ).toBe("errors.access.unknownPlace")
    expect(
      outcome(() => assignRole(mariam, daniel, ROLE_IDS.servant, { type: "account", id: daniel }))
    ).toBe("errors.access.unknownPlace")
  })

  test("the preview lists what Daniel gains and what he already has", () => {
    const { ctx, account, stage } = church()
    const preview = previewAssignment(
      ctx("christine.adel"),
      account("daniel.michael").id,
      ROLE_IDS.servant,
      stage("3rd Class")
    )

    expect(preview.ok && preview.gains.map((g) => g.group)).toEqual(
      expect.arrayContaining(["stage", "schedule", "session", "lesson"])
    )
    expect(preview.ok && preview.includes).toEqual(["Session helper"])
  })
})

describe("C: Daniel serves in 1st and 3rd Class", () => {
  test("he works in his stages, sees only his own lessons and nothing of other stages", () => {
    const { s, ctx, account, stage, scheduleOfStage, lesson } = church()
    assignRole(
      ctx("christine.adel"),
      account("daniel.michael").id,
      ROLE_IDS.servant,
      stage("3rd Class")
    )
    const daniel = account("daniel.michael")
    const unit = (name: string) => ({
      serviceId: s.stages.find((x) => x.id === stage(name).id)!.serviceId,
      stageId: stage(name).id,
    })

    expect(canSeeUnit(s, daniel, unit("3rd Class"))).toBe(true)
    expect(can(s, daniel, "lesson.create", stage("3rd Class"))).toBe(true)
    expect(can(s, daniel, "schedule.plan", scheduleOfStage("3rd Class"))).toBe(false)
    expect(canSeeUnit(s, daniel, unit("2nd Class"))).toBe(false)
    expect(can(s, daniel, "lesson.read", lesson("Joseph forgives his brothers"))).toBe(false)
    expect(can(s, daniel, "lesson.update", lesson("Noah's ark"))).toBe(true)
    expect(accessTabs(s, daniel)).toEqual({ resources: false, roles: false, guardians: false })
  })

  test("his access shows in the explorer where it was given", () => {
    const { ctx, account, stage } = church()
    assignRole(
      ctx("christine.adel"),
      account("daniel.michael").id,
      ROLE_IDS.servant,
      stage("3rd Class")
    )
    const view = getResourceAccess(ctx("christine.adel"), stage("3rd Class"))!
    const servants = view.direct.find((g) => g.role.name === "Servant")!

    expect(servants.rows.map((r) => r.person.name)).toEqual(["Daniel Michael", "Youssef Kamel"])
    expect(servants.rows.every((r) => r.revocable)).toBe(true)
  })
})

describe("D: Maria edits one lesson", () => {
  test("a role on one lesson reaches that lesson only, not its siblings in the stage", () => {
    const { s, ctx, account, lesson } = church()
    const maria = account("maria.hanna")
    assignRole(ctx("christine.adel"), maria.id, ROLE_IDS.lessonEditor, lesson("The Good Samaritan"))

    expect(can(s, maria, "lesson.update", lesson("The Good Samaritan"))).toBe(true)
    expect(can(s, maria, "task.create", lesson("The Good Samaritan"))).toBe(true)
    expect(can(s, maria, "lesson.update", lesson("Noah's ark"))).toBe(false)
    expect(can(s, maria, "lesson.read", lesson("God creates the world"))).toBe(false)

    const view = getResourceAccess(ctx("christine.adel"), lesson("The Good Samaritan"))!
    expect(view.direct.flatMap((g) => g.rows.map((r) => r.person.name))).toContain("Maria Hanna")
  })
})

describe("G: revocation", () => {
  test("removing the broader role keeps the narrower one, and recalculates", () => {
    const { s, ctx, account, service, stage, nextSession, assignmentOf } = church()
    const christine = ctx("christine.adel")
    const daniel = account("daniel.michael")
    assignRole(christine, daniel.id, ROLE_IDS.servant, stage("3rd Class"))
    assignRole(christine, daniel.id, ROLE_IDS.servant, service("Sunday School"))
    expect(can(s, daniel, "session.takeAttendance", nextSession("2nd Class"))).toBe(true)

    const broad = assignmentOf("daniel.michael", ROLE_IDS.servant, service("Sunday School"))
    const preview = previewRevocation(christine, broad.id)
    expect(preview.ok && preview.keeps.map((k) => `${k.role} ${k.scope} ${k.relation}`)).toEqual(
      expect.arrayContaining([
        "Servant Sunday School › 1st Class below",
        "Servant Sunday School › 3rd Class below",
      ])
    )

    removeAssignment(christine, broad.id)
    expect(can(s, daniel, "session.takeAttendance", nextSession("2nd Class"))).toBe(false)
    expect(can(s, daniel, "session.takeAttendance", nextSession("3rd Class"))).toBe(true)
    expect(s.accessEvents.at(-1)).toMatchObject({ kind: "revoked" })
  })

  test("inherited access can't be removed below where it was given; protected and own ones are kept", () => {
    const { s, ctx, account, service, assignmentOf } = church()
    const christine = ctx("christine.adel")
    const mariam = ctx("mariam.fahmy")
    const own = assignmentOf("christine.adel", ROLE_IDS.serviceLeader, service("Sunday School"))
    const admin = assignmentOf("mariam.fahmy", ROLE_IDS.administrator, CHURCH)

    expect(outcome(() => removeAssignment(christine, own.id))).toBe("errors.access.ownAssignments")
    expect(outcome(() => removeAssignment(christine, admin.id))).toBe("errors.access.notHere")
    expect(outcome(() => removeAssignment(mariam, admin.id))).toBe("errors.access.ownAssignments")

    assignRole(mariam, account("peter.girgis").id, ROLE_IDS.administrator, CHURCH)
    expect(outcome(() => removeAssignment(ctx("peter.girgis"), admin.id))).toBe("ok")
    expect(can(s, account("mariam.fahmy"), "role.update")).toBe(false)
  })
})

describe("A: the administrator", () => {
  test("sees the whole hierarchy and may give every role, the protected one included", () => {
    const { s, ctx, account } = church()
    const mariam = ctx("mariam.fahmy")
    const root = explorerChildren(mariam, refKey(CHURCH))

    expect(accessTabs(s, account("mariam.fahmy"))).toEqual({
      resources: true,
      roles: true,
      guardians: true,
    })
    expect(root.nodes.filter((n) => n.type === "service").map((n) => n.name)).toEqual([
      "Coptic Language Course",
      "Servants' Meeting",
      "Sunday School",
      "University Students",
      "Youth Gathering",
    ])
    expect(root.nodes.find((n) => n.kind === "group")).toMatchObject({ type: "event", count: 1 })
    expect(rolesAt(s, account("mariam.fahmy"), CHURCH).map((r) => r.name)).toContain(
      "Administrator"
    )

    const view = getResourceAccess(mariam, CHURCH)!
    const admins = view.direct.find((g) => g.role.protected)!
    expect(admins.rows[0]).toMatchObject({ revocable: false })
    expect(admins.rows[0].locked).toContain("own access")
  })
})

describe("visibility: people see only where they manage access", () => {
  test("Christine sees the church only as the way to Sunday School", async () => {
    const { ctx, service } = church()
    const christine = ctx("christine.adel")
    const start = explorerStart(christine, null)

    expect(start.root.manageable).toBe(false)
    expect(start.focus).toBe(refKey(service("Sunday School")))
    expect(start.pages[refKey(CHURCH)].nodes.map((n) => n.name)).toEqual(["Sunday School"])
    expect(getResourceAccess(christine, service("Youth Gathering"))).toBeNull()
    expect(searchExplorer(christine, "Youth")).toEqual([])
    expect(searchExplorer(christine, "3rd").map((r) => r.name)).toContain("3rd Class")
    expect((await getShell(christine)).nav.access).toBe(true)
    expect((await getShell(ctx("daniel.michael"))).nav.access).toBe(false)
  })

  test("lessons and sessions come grouped and a page at a time", () => {
    const { ctx, stage, scheduleOfStage } = church()
    const mariam = ctx("mariam.fahmy")
    const stageRows = explorerChildren(mariam, refKey(stage("3rd Class"))).nodes

    expect(stageRows.map((n) => `${n.kind}:${n.type}`)).toEqual([
      "resource:schedule",
      "group:lesson",
    ])
    const sessions = explorerChildren(mariam, refKey(scheduleOfStage("3rd Class"))).nodes[0]
    const page = explorerChildren(mariam, sessions.key)
    expect(page.nodes).toHaveLength(10)
    expect(page.next).toBe(10)
  })
})

describe("I: a new resource type plugs in through the registry", () => {
  afterEach(() => {
    unregisterAdapter("retreat")
    unregisterResourceType("retreat")
  })

  test("the built-in fictional event type: one event's coordinator can't touch another event", () => {
    const { s, ctx, account, event, service } = church()
    const sara = account("sara.wissa")

    expect(can(s, sara, "event.update", event("Parish picnic"))).toBe(true)
    expect(can(s, sara, "event.update", event("Summer camp 2027"))).toBe(false)
    expect(
      outcome(() =>
        assignRole(
          ctx("mariam.fahmy"),
          account("mark.shenouda").id,
          ROLE_IDS.eventCoordinator,
          event("Summer camp 2027")
        )
      )
    ).toBe("ok")
    expect(can(s, account("mark.shenouda"), "event.delete", event("Summer camp 2027"))).toBe(true)
    expect(
      grantProblem(
        s,
        account("christine.adel"),
        null,
        s.roles.find((r) => r.id === ROLE_IDS.eventCoordinator)!,
        service("Sunday School")
      )?.problem.detail?.key
    ).toBe("errors.access.notDelegated")
  })

  test("a type registered at runtime gets permissions, roles, assignments, checks and explorer rows", () => {
    const { s, ctx, account, service } = church()
    const retreats = [
      { id: "r1", name: "Lent retreat", serviceId: service("Youth Gathering").id },
      { id: "r2", name: "Summer retreat", serviceId: service("Youth Gathering").id },
    ]
    registerResourceType("retreat", {
      parents: ["service"],
      actions: ["create", "read", "update", "delete", "checkIn"],
      scope: true,
      listed: true,
    })
    registerAdapter("retreat", {
      parent: (_, id) => {
        const r = retreats.find((x) => x.id === id)

        return r ? { type: "service", id: r.serviceId } : undefined
      },
      under: (_, parent) =>
        retreats
          .filter((r) => parent.type === "service" && r.serviceId === parent.id)
          .map((r) => r.id),
      details: (_, id) => {
        const r = retreats.find((x) => x.id === id)

        return r ? { name: r.name, date: null, time: null } : null
      },
    })
    const mariam = ctx("mariam.fahmy")
    const lead = createRole(mariam, {
      name: "Retreat lead",
      description: "",
      inherits: [],
      permissions: ["retreat.read", "retreat.update", "retreat.checkIn"],
      assignableAt: ["retreat"],
      delegation: [],
    })
    const r1 = { type: "retreat", id: "r1" } as unknown as ResourceRef
    const r2 = { type: "retreat", id: "r2" } as unknown as ResourceRef

    expect(outcome(() => assignRole(mariam, account("peter.girgis").id, lead.id, r1))).toBe("ok")
    expect(can(s, account("peter.girgis"), "retreat.checkIn" as Permission, r1)).toBe(true)
    expect(can(s, account("peter.girgis"), "retreat.checkIn" as Permission, r2)).toBe(false)
    expect(can(s, account("mariam.fahmy"), "retreat.delete" as Permission, r2)).toBe(true)
    expect(
      explorerChildren(mariam, refKey(service("Youth Gathering"))).nodes.map((n) => n.type)
    ).toContain("retreat")
    expect(getResourceAccess(mariam, r1)!.direct[0].rows[0].person.name).toBe("Peter Girgis")
  })
})

describe("the parent relationship is not a role", () => {
  test("a parent acts only for linked children; staff roles never reach a child", () => {
    const { s, account } = church()
    const mina = s.persons.find((p) => p.firstName === "Mina")!.id
    const sophia = s.persons.find((p) => p.firstName === "Sophia")!.id

    expect(canActForChild(s, account("hoda.farag"), mina)).toBe(true)
    expect(canActForChild(s, account("hoda.farag"), sophia)).toBe(false)
    expect(canActForChild(s, account("christine.adel"), mina)).toBe(false)
  })
})
