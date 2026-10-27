/**
 * Data protection requests: erasure removes a member's or an account's data
 * but keeps past attendance totals right; a copy contains their data and no
 * one else's contact details. The demo clock is frozen at Sunday 8 November
 * 2026.
 */
import { describe, expect, test } from "vitest"

import { oneMonthAfter } from "@/lib/domain/privacy"
import { ProblemError } from "@/server/errors"

import { completeHomework, createHomework, createLesson } from "./commands/learning"
import {
  declineDataRequest,
  eraseData,
  inventoryOf,
  personalData,
  recordDataRequest,
  requestOwnErasure,
} from "./commands/privacy"
import { seed } from "./seed"
import { sessionCounts } from "./selectors"

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
  const user = (email: string) => s.users.find((x) => x.email === email)!
  const person = (first: string, last: string) =>
    s.persons.find((p) => p.firstName === first && p.lastName === last)!
  return {
    s,
    admin: user("mariam.fahmy@example.org"),
    daniel: user("daniel.michael@example.org"),
    hoda: user("hoda.farag@example.org"),
    nabil: user("nabil.hanna@example.org"),
    kiro: person("Kirollos", "Iskander"),
    c3: s.stages.find((x) => x.name === "3rd Class")!,
  }
}

const erasureOf = (t: ReturnType<typeof demo>, input: { personId?: string; userId?: string }) =>
  recordDataRequest(t.s, t.admin, {
    kind: "erasure",
    ...input,
    requestedBy: "The parents, by email",
    channel: "email",
    receivedOn: "2026-11-05",
  })

describe("erasing a member", () => {
  test("deletes their records but keeps past attendance totals", () => {
    const t = demo()
    const attended = t.s.sessions.filter((x) =>
      t.s.attendance.some((a) => a.sessionId === x.id && a.personId === t.kiro.id && !a.removedAt)
    )
    expect(attended.length).toBeGreaterThan(3)
    const before = attended.map((x) => sessionCounts(t.s, x))

    const request = erasureOf(t, { personId: t.kiro.id })
    expect(request.dueOn).toBe("2026-12-05")
    eraseData(t.s, t.admin, request.id, { clearNotes: false })

    expect(t.s.persons.find((p) => p.id === t.kiro.id)).toBeUndefined()
    expect(t.s.memberships.some((m) => m.personId === t.kiro.id)).toBe(false)
    expect(t.s.attendance.some((a) => a.personId === t.kiro.id)).toBe(false)
    expect(t.s.guardians.some((g) => g.personId === t.kiro.id)).toBe(false)
    expect(attended.map((x) => sessionCounts(t.s, x))).toEqual(before)

    expect(request.status).toBe("done")
    expect(request.subjectName).toBeNull()
    expect(request.erasedSubject).toEqual({ kind: "member", group: "3rd Class" })
    expect(request.outcome).toMatchObject({ person: 1, memberships: 1 })
    expect(JSON.stringify(t.s.dataRequests)).not.toContain("Kirollos")
  })

  test("notes that may name them are listed, and emptied on request", () => {
    const t = demo()
    const session = t.s.sessions.find((x) => x.stageId === t.c3.id && x.status === "completed")!
    t.s.events.push({
      id: "note",
      sessionId: session.id,
      type: "reopened",
      occurredAt: session.closedAt!,
      actorId: t.daniel.id,
      note: "Kiro was there but not ticked.",
    })
    const request = erasureOf(t, { personId: t.kiro.id })
    const { mentions } = inventoryOf(t.s, t.kiro, undefined)
    expect(mentions.map((m) => m.text)).toContain("Kiro was there but not ticked.")
    eraseData(t.s, t.admin, request.id, { clearNotes: true })
    expect(t.s.events.find((e) => e.id === "note")?.note).toBeNull()
    expect(request.outcome?.notes).toBeGreaterThan(0)
  })
})

describe("erasing an account", () => {
  test("removes the account; what it did stays without the name", () => {
    const t = demo()
    const lesson = createLesson(t.s, t.daniel, t.c3.id, {
      title: "Zacchaeus",
      meeting: "date:2026-11-15",
      responsibleId: t.daniel.id,
    })
    const homework = createHomework(
      t.s,
      t.daniel,
      lesson.id,
      { title: "Read Luke 19:1–10", instructions: "Read it together.", dueDate: null },
      true
    )
    const mina = t.s.persons.find((p) => p.firstName === "Mina" && p.lastName === "Hanna")!
    completeHomework(t.s, t.hoda, homework.id, mina.id)
    const minasReports = t.s.completions.filter((c) => c.personId === mina.id).length

    const request = erasureOf(t, { userId: t.hoda.id })
    eraseData(t.s, t.admin, request.id, { clearNotes: false })

    expect(t.s.users.find((u) => u.id === t.hoda.id)).toBeUndefined()
    expect(t.s.guardians.some((g) => g.userId === t.hoda.id)).toBe(false)
    // Mina's homework report stays: it is about the child, not about the parent.
    expect(t.s.completions.filter((c) => c.personId === mina.id)).toHaveLength(minasReports)
    // Hoda also comes to Bible Study: her member record belongs to the same request.
    expect(t.s.persons.some((p) => p.id === t.hoda.personId)).toBe(false)
    expect(request.erasedSubject).toEqual({ kind: "member", group: "Bible Study" })
  })

  test("administrators can't erase their own account", () => {
    const t = demo()
    const request = erasureOf(t, { userId: t.admin.id })
    expect(statusOf(() => eraseData(t.s, t.admin, request.id, { clearNotes: false }))).toBe(409)
  })
})

describe("requests", () => {
  test("someone can ask once from their account; a second request is refused", () => {
    const t = demo()
    const request = requestOwnErasure(t.s, t.nabil, null)
    expect(request).toMatchObject({ kind: "erasure", channel: "app", userId: t.nabil.id })
    expect(statusOf(() => requestOwnErasure(t.s, t.nabil, null))).toBe(409)
  })

  test("only administrators handle requests, and a refusal needs a reason", () => {
    const t = demo()
    expect(statusOf(() => erasureOf({ ...t, admin: t.daniel }, { personId: t.kiro.id }))).toBe(403)
    const request = erasureOf(t, { personId: t.kiro.id })
    expect(statusOf(() => declineDataRequest(t.s, t.admin, request.id, " "))).toBe(422)
  })

  test("a copy has the member's data, without other people's contact details", () => {
    const t = demo()
    const copy = personalData(t.s, t.kiro, undefined)
    expect(copy.member?.memberships.length).toBeGreaterThan(0)
    expect(copy.member?.attendance.length).toBeGreaterThan(0)
    expect(JSON.stringify(copy)).not.toContain("@example.org")
    const account = personalData(t.s, undefined, t.nabil)
    expect(account.account?.email).toBe("nabil.hanna@example.org")
    expect(JSON.stringify(account)).not.toContain("scrypt")
  })

  test("answers are due one month after the request arrived", () => {
    expect(oneMonthAfter("2026-11-02")).toBe("2026-12-02")
    expect(oneMonthAfter("2026-12-15")).toBe("2027-01-15")
    expect(oneMonthAfter("2027-01-31")).toBe("2027-02-28")
    expect(oneMonthAfter("2028-01-31")).toBe("2028-02-29")
  })
})
