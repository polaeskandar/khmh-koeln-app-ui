import { describe, expect, test } from "vitest"

import { CHURCH } from "@/lib/domain/types"
import { ProblemError } from "@/server/errors"
import { accountNamed, contextFor } from "@/test/context"

import { isAdministrator, isStaff } from "./access"
import { addManager, ensureAdministratorRemains, removeManager } from "./commands/access"
import {
  authenticate,
  changeOwnPassword,
  createAccount,
  deleteAccount,
  resetPassword,
} from "./commands/accounts"
import { DEMO_PASSWORD } from "./passwords"
import { seed } from "./seed"

const statusOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      return error.problem.status
    }

    throw error
  }

  return "ok"
}

const problemOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      return error.problem.detail?.key
    }

    throw error
  }

  return "ok"
}

const andrew = (s: ReturnType<typeof seed>) => s.persons.find((p) => p.firstName === "Andrew")!

describe("signing in with a username", () => {
  test("usernames are compared without case and spaces", () => {
    const s = seed("church")

    expect(authenticate(s, "  Daniel.Michael ", DEMO_PASSWORD).ok).toBe(true)
  })

  test("an unknown username and a wrong password get the same answer", () => {
    const s = seed("church")

    expect(authenticate(s, "nobody.here", DEMO_PASSWORD)).toEqual({ ok: false })
    expect(authenticate(s, "daniel.michael", "wrong-password")).toEqual({ ok: false })
  })
})

describe("accounts created by the office", () => {
  test("an administrator links a new account to an existing person and it must change its password", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const persons = s.persons.length
    const created = createAccount(mariam, {
      personId: andrew(s).id,
      firstName: "",
      lastName: "",
      username: "Andrew.Samir",
      temporaryPassword: "olive-cedar-lamp-27",
      groups: [],
      childIds: [],
    })
    const account = accountNamed(s, "andrew.samir")

    expect(created.username).toBe("andrew.samir")
    expect(s.persons.length).toBe(persons)
    expect(account.mustChangePassword).toBe(true)
    expect(JSON.stringify(s)).not.toContain("olive-cedar-lamp-27")
  })

  test("a username can only be used once", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))

    expect(
      statusOf(() =>
        createAccount(mariam, {
          personId: null,
          firstName: "Daniel",
          lastName: "Other",
          username: "DANIEL.MICHAEL",
          temporaryPassword: "olive-cedar-lamp-27",
          groups: [],
          childIds: [],
        })
      )
    ).toBe(422)
  })

  test("only administrators create accounts, and a new account has no access yet", () => {
    const s = seed("church")
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const input = {
      personId: andrew(s).id,
      firstName: "",
      lastName: "",
      username: "andrew.samir",
      temporaryPassword: "olive-cedar-lamp-27",
      groups: [],
      childIds: [],
    }

    expect(statusOf(() => createAccount(christine, input))).toBe(403)
    expect(statusOf(() => createAccount(sara, input))).toBe("ok")

    const andrewAccount = accountNamed(s, "andrew.samir")
    expect(isStaff(s, andrewAccount)).toBe(false)
    expect(s.grants.some((g) => g.accountId === andrewAccount.id)).toBe(false)
  })

  test("the first password change is required and must differ from the temporary one", () => {
    const s = seed("church")
    const rebecca = accountNamed(s, "rebecca.habib")

    expect(rebecca.mustChangePassword).toBe(true)
    expect(
      statusOf(() => changeOwnPassword(s, rebecca, DEMO_PASSWORD, DEMO_PASSWORD, DEMO_PASSWORD))
    ).toBe(422)
    changeOwnPassword(
      s,
      rebecca,
      DEMO_PASSWORD,
      "Psalm 23 is my favourite",
      "Psalm 23 is my favourite"
    )
    expect(rebecca.mustChangePassword).toBe(false)
    expect(authenticate(s, "rebecca.habib", "Psalm 23 is my favourite").ok).toBe(true)
  })

  test("a reset gives a new temporary password that must be changed again", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    resetPassword(mariam, accountNamed(s, "daniel.michael").id, "new-temporary-1")

    expect(accountNamed(s, "daniel.michael").mustChangePassword).toBe(true)
    expect(authenticate(s, "daniel.michael", DEMO_PASSWORD).ok).toBe(false)
  })

  test("only administrators reset or delete accounts, and never their own here", () => {
    const s = seed("church")
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))
    const christine = contextFor(s, accountNamed(s, "christine.adel"))

    expect(
      statusOf(() =>
        resetPassword(christine, accountNamed(s, "daniel.michael").id, "new-temporary-1")
      )
    ).toBe(403)
    expect(statusOf(() => deleteAccount(christine, accountNamed(s, "hoda.farag").id))).toBe(403)
    expect(statusOf(() => resetPassword(sara, sara.viewer.id, "new-temporary-1"))).toBe(409)
    expect(statusOf(() => deleteAccount(sara, accountNamed(s, "hoda.farag").id))).toBe("ok")
  })

  test("deleting an account keeps the person and what the account did", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const daniel = accountNamed(s, "daniel.michael")
    const lessons = s.lessons.filter((l) => l.responsibleId === daniel.id).length
    deleteAccount(mariam, daniel.id)

    expect(s.accounts.some((a) => a.id === daniel.id)).toBe(false)
    expect(s.persons.some((p) => p.id === daniel.personId)).toBe(true)
    expect(s.grants.some((g) => g.accountId === daniel.id)).toBe(false)
    expect(lessons).toBeGreaterThan(0)
    expect(JSON.stringify(s)).not.toContain(daniel.id)
  })
})

describe("administrators", () => {
  test("someone always stays administrator, and nobody changes their own access", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))
    const managerOf = (username: string) =>
      s.managers.find(
        (m) => m.accountId === accountNamed(s, username).id && m.resource.type === "church"
      )!

    expect(problemOf(() => removeManager(mariam, managerOf("mariam.fahmy").id))).toBe(
      "errors.access.ownAccess"
    )
    removeManager(mariam, managerOf("sara.wissa").id)
    expect(isAdministrator(s, sara.viewer)).toBe(false)
    expect(statusOf(() => deleteAccount(sara, accountNamed(s, "hoda.farag").id))).toBe(403)

    addManager(mariam, sara.viewer.id, CHURCH)
    removeManager(sara, managerOf("mariam.fahmy").id)
    expect(isAdministrator(s, mariam.viewer)).toBe(false)
    expect(
      problemOf(() => ensureAdministratorRemains(s, { removedAccountId: sara.viewer.id }))
    ).toBe("errors.access.lastAdministrator")
  })
})
