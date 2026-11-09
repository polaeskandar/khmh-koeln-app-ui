/**
 * Registration, sign-in and approval: a new registration reaches the office once its email
 * address is confirmed, the account can't be used until an administrator approves it, and
 * declined registrations leave nothing behind.
 */
import { describe, expect, test, vi } from "vitest"

import { DEFAULT_ROLES, isActiveAccount } from "@/lib/domain/policy"
import type { User } from "@/lib/domain/types"
import { ProblemError } from "@/server/errors"
import { getAccountRequests } from "@/server/queries/accounts"
import { contextFor } from "@/test/context"

import { DEMO_START, resetClock } from "./clock"
import {
  approveAccount,
  authenticate,
  confirmEmail,
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

const tokenOf = (user: User) => user.emailConfirmation!.token

async function requestedNames(t: ReturnType<typeof demo>) {
  const requests = await getAccountRequests(contextFor(t.s, t.admin))
  return requests!.requests.map((r) => r.name)
}

describe("registration", () => {
  test("a new account confirms its email address, then waits for approval", async () => {
    const t = demo()
    const user = register(t.s, parent)
    expect(user.email).toBe("sara.hanna@example.org")
    expect(user.roleIds).toEqual([])
    expect(user.permissions).toEqual([])
    expect(isActiveAccount(user)).toBe(false)
    expect(authenticate(t.s, "sara.hanna@example.org", "a long enough password")).toEqual({
      ok: false,
      reason: "unconfirmed",
    })
    expect(await requestedNames(t)).not.toContain("Sara Hanna")

    expect(confirmEmail(t.s, tokenOf(user))).toBe(true)
    expect(user.emailConfirmation).toBeNull()
    expect(authenticate(t.s, "sara.hanna@example.org", "a long enough password")).toEqual({
      ok: false,
      reason: "pending",
    })
    expect(await requestedNames(t)).toContain("Sara Hanna")
  })

  test("a link works once and for 7 days", () => {
    vi.useFakeTimers()
    vi.stubEnv("KHMK_DEMO_CLOCK", "running")
    try {
      vi.setSystemTime(DEMO_START)
      resetClock()
      const t = demo()
      const late = register(t.s, parent)
      const onTime = register(t.s, { ...parent, email: "hanna.family@example.org" })
      const lateToken = tokenOf(late)
      const onTimeToken = tokenOf(onTime)

      vi.setSystemTime(DEMO_START + 7 * 86_400_000 - 60_000)
      expect(confirmEmail(t.s, onTimeToken)).toBe(true)
      expect(confirmEmail(t.s, onTimeToken)).toBe(false)
      vi.setSystemTime(DEMO_START + 7 * 86_400_000)
      expect(confirmEmail(t.s, lateToken)).toBe(false)
      expect(confirmEmail(t.s, "")).toBe(false)
      expect(late.emailConfirmedAt).toBeNull()
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })

  test("registering again sends a new link that voids the older one", async () => {
    const t = demo()
    const user = register(t.s, parent)
    const first = tokenOf(user)
    const count = t.s.users.length
    const again = register(t.s, { ...parent, firstName: "Sarah", password: "another password" })
    expect(again).toBe(user)
    expect(t.s.users.length).toBe(count)
    expect(user.displayName).toBe("Sara Hanna")
    expect(tokenOf(user)).not.toBe(first)

    expect(confirmEmail(t.s, first)).toBe(false)
    expect(confirmEmail(t.s, tokenOf(user))).toBe(true)
    expect(authenticate(t.s, user.email, "a long enough password")).toEqual({
      ok: false,
      reason: "pending",
    })
    const problem = problemOf(() => register(t.s, parent))
    expect(Object.keys(problem?.fieldErrors ?? {})).toEqual(["email"])
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
