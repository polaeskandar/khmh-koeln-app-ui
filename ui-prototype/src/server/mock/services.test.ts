/**
 * The rules for services (create, edit, archive, restore, delete) and the
 * dashboard's "Today", checked against the mock backend layer. The demo clock
 * is frozen at Sunday 8 November 2026, 12:08.
 */
import { describe, expect, test } from "vitest"

import { ProblemError } from "@/server/errors"
import { getDashboard } from "@/server/queries/dashboard"
import { serviceTone } from "@/server/queries/present"
import { contextFor } from "@/test/context"

import {
  archiveService,
  createService,
  deleteService,
  restoreService,
  updateService,
} from "./commands/services"
import { seed } from "./seed"

/** The HTTP status of the problem a command raises: 403, 404, 409 or 422. */
function statusOf(command: () => unknown): number | null {
  try {
    command()
    return null
  } catch (e) {
    if (e instanceof ProblemError) return e.problem.status
    throw e
  }
}

function demo() {
  const s = seed()
  const user = (email: string) => {
    const u = s.users.find((x) => x.email === email)
    if (!u) throw new Error(`No demo account ${email}`)
    return u
  }
  const service = (name: string) => {
    const x = s.services.find((y) => y.name === name)
    if (!x) throw new Error(`No demo service ${name}`)
    return x
  }
  return {
    s,
    service,
    admin: user("mariam.fahmy@example.org"),
    leader: user("christine.adel@example.org"), // service leader, Sunday School
    daniel: user("daniel.michael@example.org"), // servant, Sunday School › 3rd Class
  }
}

describe("services", () => {
  test("only administrators create, archive and delete services", () => {
    const t = demo()
    const sundaySchool = t.service("Sunday School")
    expect(statusOf(() => createService(t.s, t.leader, { name: "Family Meeting" }))).toBe(403)
    expect(statusOf(() => archiveService(t.s, t.leader, sundaySchool.id))).toBe(403)
    expect(statusOf(() => deleteService(t.s, t.leader, t.service("Choir").id))).toBe(403)

    const created = createService(t.s, t.admin, { name: "Family Meeting", description: null })
    expect(t.s.services).toContain(created)
  })

  test("a service leader edits the service they lead, and no other", () => {
    const t = demo()
    const sundaySchool = t.service("Sunday School")
    updateService(t.s, t.leader, sundaySchool.id, {
      name: "Sunday School",
      description: "Classes after the Divine Liturgy.",
    })
    expect(sundaySchool.description).toBe("Classes after the Divine Liturgy.")
    const youth = t.service("Youth Meeting")
    expect(statusOf(() => updateService(t.s, t.leader, youth.id, { name: "Youth" }))).toBe(403)
  })

  test("names are unique, ignoring case and extra spaces", () => {
    const t = demo()
    expect(statusOf(() => createService(t.s, t.admin, { name: "  sunday   SCHOOL " }))).toBe(422)
  })

  test("a service with meeting history is archived and restored, never deleted", () => {
    const t = demo()
    const youth = t.service("Youth Meeting")
    expect(statusOf(() => deleteService(t.s, t.admin, youth.id))).toBe(409)
    archiveService(t.s, t.admin, youth.id)
    expect(youth.archivedAt).not.toBeNull()
    restoreService(t.s, t.admin, youth.id)
    expect(youth.archivedAt).toBeNull()
  })

  test("a service that never met can be deleted", () => {
    const t = demo()
    const choir = t.service("Choir")
    deleteService(t.s, t.admin, choir.id)
    expect(t.s.services.some((x) => x.id === choir.id)).toBe(false)
  })

  test("colours stay with their service; a new one takes a free colour", () => {
    const t = demo()
    const first = createService(t.s, t.admin, { name: "Family Meeting" })
    const second = createService(t.s, t.admin, { name: "Scouts" })
    const firstTone = serviceTone(t.s, first.id)
    const secondTone = serviceTone(t.s, second.id)
    expect(secondTone).not.toBe(firstTone)

    deleteService(t.s, t.admin, first.id)
    expect(serviceTone(t.s, second.id)).toBe(secondTone)
    const third = createService(t.s, t.admin, { name: "Bible Quiz" })
    expect(serviceTone(t.s, third.id)).toBe(firstTone)
  })
})

describe("dashboard", () => {
  test("Today lists every meeting of the day in the viewer's services, their own first", async () => {
    const t = demo()
    const d = await getDashboard(contextFor(t.s, t.daniel))
    expect(d.todaySessions.map((x) => x.group)).toEqual([
      "3rd Class",
      "Kindergarten",
      "1st Class",
      "2nd Class",
      "4th Class",
      "5th & 6th Class",
    ])
    expect(d.todaySessions.filter((x) => x.can.record).map((x) => x.group)).toEqual(["3rd Class"])
  })
})
