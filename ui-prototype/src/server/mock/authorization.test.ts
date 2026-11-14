/**
 * The permission system: members get Create, Read, Update and Delete for a type of resource
 * within a resource, which counts there and below it; whoever manages access within a resource
 * gives and removes them there, never more than they have themselves.
 */
import { afterEach, describe, expect, test } from "vitest"

import {
  type Action,
  CHURCH,
  refKey,
  registerResourceType,
  type ResourceRef,
  type ResourceType,
  unregisterResourceType,
} from "@/lib/domain/resources"
import { ProblemError } from "@/server/errors"
import { getAccessView, treeChildren, treeStart } from "@/server/queries/access"
import { getShell } from "@/server/queries/shell"
import { accountNamed, contextFor } from "@/test/context"

import { can, canActForChild, holds, isAdministrator } from "./access"
import { addManager, removeManager, revokeGrant, saveGrant } from "./commands/access"
import { deleteLesson } from "./commands/learning"
import { setStageArchived } from "./commands/services"
import { registerAdapter, unregisterAdapter } from "./resources"
import { seed } from "./seed"

const outcome = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      const field = Object.values(error.problem.fieldErrors ?? {})[0]?.key

      return field ?? error.problem.detail?.key ?? error.problem.status
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
  const stage = (name: string): ResourceRef => ({
    type: "stage",
    id: s.stages.find((x) => x.name === name && x.serviceId === service("Sunday School").id)!.id,
  })
  const lesson = (title: string): ResourceRef => ({
    type: "lesson",
    id: s.lessons.find((l) => l.title === title)!.id,
  })
  const give = (
    by: string,
    to: string,
    resource: ResourceRef,
    type: ResourceType,
    actions: Action[]
  ) => outcome(() => saveGrant(ctx(by), { accountId: account(to).id, resource, type, actions }))

  return { s, ctx, account, service, stage, lesson, give }
}

describe("permissions apply to their resource and below it, never elsewhere", () => {
  test("Daniel creates and reads lessons in 3rd Class, but changes none and reaches no other class", () => {
    const { s, account, stage, lesson, give } = church()
    const daniel = account("daniel.michael")

    expect(can(s, daniel, "lesson.create", stage("3rd Class"))).toBe(false)
    expect(
      give("christine.adel", "daniel.michael", stage("3rd Class"), "lesson", ["create", "read"])
    ).toBe("ok")

    expect(can(s, daniel, "lesson.create", stage("3rd Class"))).toBe(true)
    expect(can(s, daniel, "lesson.read", lesson("Joseph forgives his brothers"))).toBe(true)
    expect(can(s, daniel, "lesson.update", lesson("Joseph forgives his brothers"))).toBe(false)
    expect(can(s, daniel, "lesson.create", stage("2nd Class"))).toBe(false)
    expect(can(s, daniel, "lesson.read", lesson("David and Goliath"))).toBe(false)
  })

  test("Maria reads and updates one lesson, and nothing else in its stage", () => {
    const { s, account, stage, lesson, give } = church()
    const maria = account("maria.hanna")

    expect(
      give("christine.adel", "maria.hanna", lesson("The Good Samaritan"), "lesson", [
        "read",
        "update",
      ])
    ).toBe("ok")

    expect(can(s, maria, "lesson.read", lesson("The Good Samaritan"))).toBe(true)
    expect(can(s, maria, "lesson.update", lesson("The Good Samaritan"))).toBe(true)
    expect(can(s, maria, "lesson.delete", lesson("The Good Samaritan"))).toBe(false)
    expect(can(s, maria, "lesson.read", lesson("Noah's ark"))).toBe(false)
    expect(can(s, maria, "lesson.create", stage("1st Class"))).toBe(false)
    expect(can(s, maria, "stage.read", stage("1st Class"))).toBe(false)
  })

  test("permissions for Sunday School reach its stages and lessons, never Youth Gathering", () => {
    const { s, account, service, stage, lesson } = church()
    const christine = account("christine.adel")

    expect(can(s, christine, "lesson.update", lesson("Joseph forgives his brothers"))).toBe(true)
    expect(can(s, christine, "stage.create", service("Sunday School"))).toBe(true)
    expect(can(s, christine, "session.update", stage("4th Class"))).toBe(true)
    expect(can(s, christine, "lesson.read", lesson("Prayer in everyday life"))).toBe(false)
    expect(can(s, christine, "service.update", service("Youth Gathering"))).toBe(false)
  })

  test("a permission counts only for its own type", () => {
    const { s, account, service, stage } = church()
    const daniel = account("daniel.michael")

    expect(can(s, daniel, "lesson.update", stage("1st Class"))).toBe(true)
    expect(can(s, daniel, "stage.update", stage("1st Class"))).toBe(false)
    expect(can(s, daniel, "service.read", service("Sunday School"))).toBe(false)
  })

  test("creating is checked where the new resource will be; on a resource itself there is nothing to create", () => {
    const { lesson, give } = church()

    expect(give("mariam.fahmy", "maria.hanna", lesson("Noah's ark"), "lesson", ["create"])).toBe(
      "errors.access.chooseActions"
    )
    expect(give("mariam.fahmy", "maria.hanna", lesson("Noah's ark"), "task", ["create"])).toBe("ok")
  })

  test("unknown resources give nothing, even to an administrator; archived ones are read-only until restored", () => {
    const { s, ctx, account, stage } = church()
    const mariam = account("mariam.fahmy")

    expect(holds(s, mariam, "lesson", "update", { type: "lesson", id: "missing" })).toBe(false)
    expect(holds(s, mariam, "lesson", "read", { type: "nothing" as ResourceType, id: "x" })).toBe(
      false
    )

    setStageArchived(ctx("mariam.fahmy"), stage("4th Class").id, true)
    expect(can(s, account("christine.adel"), "lesson.create", stage("4th Class"))).toBe(false)
    expect(can(s, account("christine.adel"), "stage.read", stage("4th Class"))).toBe(true)
    expect(
      outcome(() => setStageArchived(ctx("daniel.michael"), stage("4th Class").id, false))
    ).toBe("errors.notFound.stage")

    expect(
      outcome(() => setStageArchived(ctx("christine.adel"), stage("4th Class").id, false))
    ).toBe("ok")
    expect(can(s, account("christine.adel"), "lesson.create", stage("4th Class"))).toBe(true)
  })

  test("deleting a resource removes the access given on it", () => {
    const { s, ctx, account, lesson, give } = church()
    give("christine.adel", "maria.hanna", lesson("The Sermon on the Mount"), "lesson", ["read"])
    const id = lesson("The Sermon on the Mount").id
    deleteLesson(ctx("christine.adel"), id)

    expect(s.grants.some((g) => g.resource.id === id)).toBe(false)
    expect(can(s, account("maria.hanna"), "lesson.read", { type: "lesson", id })).toBe(false)
  })
})

describe("managing access", () => {
  test("Christine manages Sunday School: she gives and removes access there, nowhere else", () => {
    const { s, ctx, account, service, stage, give } = church()

    expect(give("christine.adel", "daniel.michael", stage("3rd Class"), "lesson", ["read"])).toBe(
      "ok"
    )
    expect(
      give("christine.adel", "daniel.michael", service("Youth Gathering"), "lesson", ["read"])
    ).toBe("errors.access.notHere")
    expect(give("christine.adel", "daniel.michael", CHURCH, "service", ["read"])).toBe(
      "errors.access.notHere"
    )

    const grant = s.grants.find(
      (g) =>
        g.accountId === account("daniel.michael").id &&
        g.type === "lesson" &&
        g.resource.type === "stage" &&
        g.resource.id === stage("3rd Class").id
    )!
    expect(outcome(() => revokeGrant(ctx("christine.adel"), grant.id))).toBe("ok")
    expect(can(s, account("daniel.michael"), "lesson.read", stage("3rd Class"))).toBe(false)

    const youth = s.grants.find(
      (g) =>
        g.accountId === account("daniel.michael").id &&
        g.resource.id === service("Youth Gathering").id
    )!
    expect(outcome(() => revokeGrant(ctx("christine.adel"), youth.id))).toBe(
      "errors.access.notHere"
    )
  })

  test("she never gives more than she has herself, nor administration, nor anything to herself", () => {
    const { ctx, account, service, stage, give } = church()

    expect(
      give("christine.adel", "daniel.michael", service("Sunday School"), "service", ["delete"])
    ).toBe("errors.access.beyondOwn")
    expect(give("christine.adel", "christine.adel", stage("3rd Class"), "lesson", ["read"])).toBe(
      "errors.access.ownAccess"
    )
    expect(
      outcome(() =>
        addManager(ctx("christine.adel"), account("daniel.michael").id, stage("3rd Class"))
      )
    ).toBe("errors.access.administratorsOnly")
    expect(
      outcome(() => addManager(ctx("christine.adel"), account("daniel.michael").id, CHURCH))
    ).toBe("errors.access.administratorsOnly")
  })

  test("changing a grant keeps what an administrator gave; she adds only what she has", () => {
    const { s, account, service, give } = church()
    give("mariam.fahmy", "daniel.michael", service("Sunday School"), "service", ["read", "delete"])

    expect(
      give("christine.adel", "daniel.michael", service("Sunday School"), "service", [
        "read",
        "update",
        "delete",
      ])
    ).toBe("ok")
    expect(can(s, account("daniel.michael"), "service.delete", service("Sunday School"))).toBe(true)
  })

  test("administrators give access anywhere and choose who manages access", () => {
    const { s, ctx, account, service, give } = church()

    expect(isAdministrator(s, account("mariam.fahmy"))).toBe(true)
    expect(
      give("mariam.fahmy", "peter.girgis", service("Youth Gathering"), "lesson", ["read"])
    ).toBe("ok")
    addManager(ctx("mariam.fahmy"), account("peter.girgis").id, service("Youth Gathering"))
    expect(
      give("peter.girgis", "daniel.michael", service("Youth Gathering"), "lesson", ["read"])
    ).toBe("ok")

    const peterManages = s.managers.find(
      (m) =>
        m.accountId === account("peter.girgis").id &&
        m.resource.type === "service" &&
        m.resource.id === service("Youth Gathering").id
    )!
    removeManager(ctx("mariam.fahmy"), peterManages.id)
    expect(
      give("peter.girgis", "daniel.michael", service("Youth Gathering"), "lesson", ["update"])
    ).toBe("errors.access.notHere")
  })
})

describe("the Access page", () => {
  test("Christine sees Sunday School; the church only as the way there", async () => {
    const { ctx, service } = church()
    const christine = ctx("christine.adel")
    const start = treeStart(christine, null, null)

    expect(start.root.manageable).toBe(false)
    expect(start.focus).toEqual(service("Sunday School"))
    expect(start.pages[refKey(CHURCH)].nodes.map((n) => n.name)).toEqual(["Sunday School"])
    expect(getAccessView(christine, service("Youth Gathering"), null)).toBeNull()
    expect((await getShell(christine)).nav.access).toBe(true)
    expect((await getShell(ctx("daniel.michael"))).nav.access).toBe(false)
  })

  test("a stage shows who has access, given there or above, and lessons come as a group", () => {
    const { ctx, stage } = church()
    const view = getAccessView(ctx("christine.adel"), stage("3rd Class"), null)!
    const byName = (name: string) => view.members.find((m) => m.person.name === name)!

    expect(byName("Youssef Kamel").lines.every((l) => l.from === null && l.editable)).toBe(true)
    expect(byName("Christine Adel").lines.every((l) => l.from?.name === "Sunday School")).toBe(true)
    expect(byName("Christine Adel").lines.some((l) => l.kind === "manager")).toBe(true)
    expect(byName("Mariam Fahmy").administrator).toBe(true)
    expect(view.options.map((o) => o.type)).toEqual(["stage", "session", "lesson", "task"])

    const rows = treeChildren(ctx("mariam.fahmy"), refKey(stage("3rd Class"))).nodes
    expect(rows.map((n) => `${n.kind}:${n.type}`)).toEqual(["group:session", "group:lesson"])
  })

  test("a group shows only that type, and offers only what the viewer may give", () => {
    const { ctx, stage } = church()
    const view = getAccessView(ctx("christine.adel"), stage("3rd Class"), "lesson")!

    expect(
      view.members.flatMap((m) => m.lines).every((l) => l.kind === "manager" || l.type === "lesson")
    ).toBe(true)
    expect(view.options).toEqual([
      {
        type: "lesson",
        actions: (["create", "read", "update", "delete"] as const).map((action) => ({
          action,
          allowed: true,
        })),
      },
    ])
  })
})

describe("a new type of resource needs no new permission code", () => {
  afterEach(() => {
    unregisterAdapter("retreat")
    unregisterResourceType("retreat")
  })

  test("retreats under a service get permissions, checks and a place in the tree", () => {
    const { s, ctx, account, service, give } = church()
    const retreats = [
      { id: "r1", name: "Lent retreat", serviceId: service("Youth Gathering").id },
      { id: "r2", name: "Summer retreat", serviceId: service("Youth Gathering").id },
    ]
    registerResourceType("retreat", { parents: ["service"], grouped: true })
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
    const r1 = { type: "retreat", id: "r1" } as unknown as ResourceRef
    const r2 = { type: "retreat", id: "r2" } as unknown as ResourceRef

    expect(
      give("mariam.fahmy", "peter.girgis", r1, "retreat" as ResourceType, ["read", "update"])
    ).toBe("ok")
    expect(holds(s, account("peter.girgis"), "retreat" as ResourceType, "update", r1)).toBe(true)
    expect(holds(s, account("peter.girgis"), "retreat" as ResourceType, "update", r2)).toBe(false)
    expect(
      treeChildren(ctx("mariam.fahmy"), refKey(service("Youth Gathering"))).nodes.map((n) => n.type)
    ).toContain("retreat")
  })
})

describe("parents reach children through links, not permissions", () => {
  test("Hoda acts for Mina and Mimi only", () => {
    const { s, account } = church()
    const person = (first: string) => s.persons.find((p) => p.firstName === first)!.id

    expect(canActForChild(s, account("hoda.farag"), person("Mina"))).toBe(true)
    expect(canActForChild(s, account("hoda.farag"), person("Sophia"))).toBe(false)
    expect(canActForChild(s, account("christine.adel"), person("Mina"))).toBe(false)
  })
})
