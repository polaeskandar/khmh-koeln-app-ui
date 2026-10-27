/**
 * Registration, sign-in and approval: a new account can't be used until an
 * administrator approves it, and declined registrations leave nothing behind.
 */
import { describe, expect, test } from "vitest"

import { isActiveAccount } from "@/lib/domain/policy"
import { ProblemError } from "@/server/errors"

import {
  approveAccount,
  authenticate,
  declineAccount,
  register,
  type RegistrationInput,
} from "./commands/accounts"
import { DEMO_PASSWORD } from "./passwords"
import { seed } from "./seed"
import { childrenOf } from "./selectors"

function problemOf(command: () => unknown) {
  try {
    command()
    return null
  } catch (e) {
    if (e instanceof ProblemError) return e.problem
    throw e
  }
}

function demo() {
  const s = seed()
  const user = (email: string) => s.users.find((x) => x.email === email)!
  return {
    s,
    admin: user("mariam.fahmy@example.org"),
    leader: user("christine.adel@example.org"),
    mina: s.persons.find((p) => p.firstName === "Mina" && p.lastName === "Hanna")!,
    youth: s.services.find((x) => x.name === "Youth Meeting")!,
    c3: s.stages.find((x) => x.name === "3rd Class")!,
  }
}

const parent: RegistrationInput = {
  firstName: "Sara",
  lastName: "Hanna",
  email: "Sara.Hanna@Example.org ",
  password: "a long enough password",
  as: "parent",
  details: "Mina Hanna, 3rd Class",
  language: "de",
  acceptPrivacy: true,
}

describe("registration", () => {
  test("a new account waits for approval and can't sign in yet", () => {
    const t = demo()
    const user = register(t.s, parent)
    expect(user.email).toBe("sara.hanna@example.org")
    expect(user.roles).toEqual([])
    expect(isActiveAccount(user)).toBe(false)
    expect(authenticate(t.s, "sara.hanna@example.org", "a long enough password")).toEqual({
      ok: false,
      reason: "pending",
    })
  })

  test("a wrong password and an unknown email get the same answer", () => {
    const t = demo()
    register(t.s, parent)
    expect(authenticate(t.s, "sara.hanna@example.org", "wrong password")).toEqual({
      ok: false,
      reason: "wrong",
    })
    expect(authenticate(t.s, "nobody@example.org", "wrong password")).toEqual({
      ok: false,
      reason: "wrong",
    })
  })

  test("checks every field at once", () => {
    const t = demo()
    const problem = problemOf(() =>
      register(t.s, {
        ...parent,
        email: "christine.adel@example.org",
        password: "short",
        details: " ",
        acceptPrivacy: false,
      })
    )
    expect(problem?.status).toBe(422)
    expect(Object.keys(problem?.fieldErrors ?? {}).sort()).toEqual([
      "acceptPrivacy",
      "details",
      "email",
      "password",
    ])
  })

  test("servants say which service they serve in", () => {
    const t = demo()
    const problem = problemOf(() =>
      register(t.s, { ...parent, as: "servant", details: "Youth", serviceId: null })
    )
    expect(Object.keys(problem?.fieldErrors ?? {})).toEqual(["serviceId"])
  })
})

describe("approval", () => {
  test("approving a parent links the children; then they can sign in", () => {
    const t = demo()
    const user = register(t.s, parent)
    approveAccount(t.s, t.admin, user.id, { as: "parent", childIds: [t.mina.id] })
    expect(childrenOf(t.s, user.id).map((p) => p.id)).toEqual([t.mina.id])
    expect(user.registration).toBeNull()
    const result = authenticate(t.s, "sara.hanna@example.org", "a long enough password")
    expect(result.ok).toBe(true)
  })

  test("approving a servant gives the role, narrowed to a stage of that service", () => {
    const t = demo()
    const user = register(t.s, { ...parent, as: "servant", serviceId: t.youth.id })
    const wrongStage = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, {
        as: "servant",
        role: "servant",
        serviceId: t.youth.id,
        stageId: t.c3.id,
      })
    )
    expect(wrongStage?.fieldErrors).toHaveProperty("stageId")
    approveAccount(t.s, t.admin, user.id, { as: "servant", role: "servant", serviceId: t.youth.id })
    expect(user.roles).toEqual([{ role: "servant", serviceId: t.youth.id, stageId: null }])
  })

  test("only administrators approve, and a parent needs at least one child", () => {
    const t = demo()
    const user = register(t.s, parent)
    expect(
      problemOf(() => approveAccount(t.s, t.leader, user.id, { as: "parent", childIds: [] }))
        ?.status
    ).toBe(403)
    expect(
      problemOf(() => approveAccount(t.s, t.admin, user.id, { as: "parent", childIds: [] }))?.status
    ).toBe(422)
  })

  test("declining deletes the account and what the person entered", () => {
    const t = demo()
    const user = register(t.s, parent)
    declineAccount(t.s, t.admin, user.id)
    expect(t.s.users.find((u) => u.id === user.id)).toBeUndefined()
    expect(authenticate(t.s, "sara.hanna@example.org", "a long enough password").ok).toBe(false)
  })

  test("the demo accounts sign in with the demo password; waiting ones don't", () => {
    const t = demo()
    expect(authenticate(t.s, "daniel.michael@example.org", DEMO_PASSWORD).ok).toBe(true)
    const waiting = t.s.users.filter((u) => u.approvedAt === null)
    expect(waiting.map((u) => u.registration?.as).sort()).toEqual(["parent", "servant"])
    for (const u of waiting) {
      expect(authenticate(t.s, u.email, DEMO_PASSWORD)).toEqual({ ok: false, reason: "pending" })
    }
  })
})
