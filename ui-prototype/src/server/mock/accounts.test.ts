/**
 * Registration, sign-in and approval: a new account can't be used until an
 * administrator approves it, and declined registrations leave nothing behind.
 */
import { describe, expect, test } from "vitest"

import { DEFAULT_ROLES, isActiveAccount } from "@/lib/domain/policy"
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
    servant: s.roles.find((r) => r.name === "Servant")!,
    parentRole: s.roles.find((r) => r.name === "Parent")!,
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
    expect(user.roleIds).toEqual([])
    expect(user.permissions).toEqual([])
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
  test("approving a parent links the children and gives the roles; then they can sign in", () => {
    const t = demo()
    const user = register(t.s, parent)
    approveAccount(t.s, t.admin, user.id, {
      as: "parent",
      childIds: [t.mina.id],
      roleIds: [t.parentRole.id],
    })
    expect(childrenOf(t.s, user.id).map((p) => p.id)).toEqual([t.mina.id])
    expect(user.roleIds).toEqual([t.parentRole.id])
    expect(user.permissions).toEqual(["parentPortal:read"])
    expect(user.registration).toBeNull()
    const result = authenticate(t.s, "sara.hanna@example.org", "a long enough password")
    expect(result.ok).toBe(true)
  })

  test("approving a servant gives the chosen roles, which hold in every service", () => {
    const t = demo()
    const user = register(t.s, { ...parent, as: "servant", serviceId: t.youth.id })
    const none = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, { as: "servant", roleIds: [] })
    )
    expect(none?.fieldErrors).toHaveProperty("roleIds")
    const unknown = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, {
        as: "servant",
        roleIds: ["019a3f00-0000-7000-8000-0000000000ff"],
      })
    )
    expect(unknown?.fieldErrors).toHaveProperty("roleIds")
    approveAccount(t.s, t.admin, user.id, { as: "servant", roleIds: [t.servant.id] })
    expect(user.roleIds).toEqual([t.servant.id])
    expect(user.permissions).toEqual(DEFAULT_ROLES[2].permissions)
  })

  test("approving needs Accounts: Add, and a parent needs a child and a role", () => {
    const t = demo()
    const user = register(t.s, parent)
    expect(
      problemOf(() =>
        approveAccount(t.s, t.leader, user.id, {
          as: "parent",
          childIds: [t.mina.id],
          roleIds: [t.parentRole.id],
        })
      )?.status
    ).toBe(403)
    const problem = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, { as: "parent", childIds: [], roleIds: [] })
    )
    expect(problem?.status).toBe(422)
    expect(Object.keys(problem?.fieldErrors ?? {})).toEqual(["childIds", "roleIds"])
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
