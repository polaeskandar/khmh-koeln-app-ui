import { describe, expect, test } from "vitest"

import { ROLE_IDS } from "@/lib/domain/policy"
import { CHURCH } from "@/lib/domain/types"
import { ProblemError } from "@/server/errors"
import { accountNamed, contextFor } from "@/test/context"

import { can } from "./access"
import { assignRole, deleteRole, removeAssignment } from "./commands/access"
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

const servantFor = (s: ReturnType<typeof seed>) => {
  const second = s.stages.find((x) => x.name === "2nd Class")!

  return [
    {
      roleId: ROLE_IDS.servant,
      resource: { type: "stage" as const, id: second.id },
    },
  ]
}

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
      roles: servantFor(s),
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
          roles: servantFor(s),
          groups: [],
          childIds: [],
        })
      )
    ).toBe(422)
  })

  test("the church office creates parent and member accounts but can't give servant roles", () => {
    const s = seed("church")
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))
    const input = {
      personId: andrew(s).id,
      firstName: "",
      lastName: "",
      username: "andrew.samir",
      temporaryPassword: "olive-cedar-lamp-27",
      groups: [],
      childIds: [],
    }

    expect(statusOf(() => createAccount(sara, { ...input, roles: servantFor(s) }))).toBe(403)
    expect(
      statusOf(() =>
        createAccount(sara, {
          ...input,
          roles: [{ roleId: ROLE_IDS.member, resource: CHURCH }],
        })
      )
    ).toBe("ok")
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

  test("the office can't reset or delete an account that may do more than the office", () => {
    const s = seed("church")
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))

    expect(
      statusOf(() => resetPassword(sara, accountNamed(s, "mariam.fahmy").id, "new-temporary-1"))
    ).toBe(403)
    expect(statusOf(() => deleteAccount(sara, accountNamed(s, "christine.adel").id))).toBe(403)
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
    expect(s.assignments.some((a) => a.accountId === daniel.id)).toBe(false)
    expect(lessons).toBeGreaterThan(0)
    expect(JSON.stringify(s)).not.toContain(daniel.id)
  })
})

describe("roles and where they apply", () => {
  test("nobody changes their own roles, and the church office gives only its approved roles", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))

    expect(statusOf(() => assignRole(mariam, mariam.viewer.id, ROLE_IDS.parent, CHURCH))).toBe(403)
    expect(
      statusOf(() =>
        assignRole(sara, accountNamed(s, "hoda.farag").id, ROLE_IDS.administrator, CHURCH)
      )
    ).toBe(403)
  })

  test("a role holding administration permissions fits only the whole church", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const mark = accountNamed(s, "mark.shenouda")
    const youth = {
      type: "service" as const,
      id: s.services.find((x) => x.name === "Youth Gathering")!.id,
    }

    expect(statusOf(() => assignRole(mariam, mark.id, ROLE_IDS.administrator, youth))).toBe(422)
    expect(can(s, mark, "service.read", youth)).toBe(true)
    expect(can(s, mark, "account.read")).toBe(false)
  })

  test("someone always keeps the Administrator role for the whole church", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    assignRole(mariam, christine.viewer.id, ROLE_IDS.administrator, CHURCH)
    const mariams = s.assignments.find(
      (a) => a.accountId === mariam.viewer.id && a.roleId === ROLE_IDS.administrator
    )!
    removeAssignment(christine, mariams.id)
    const christines = s.assignments.find(
      (a) => a.accountId === christine.viewer.id && a.roleId === ROLE_IDS.administrator
    )!

    expect(problemOf(() => removeAssignment(christine, christines.id))).toBe(
      "errors.access.ownAssignments"
    )
    expect(problemOf(() => deleteRole(christine, ROLE_IDS.administrator))).toBe(
      "errors.roles.protected"
    )
  })
})
