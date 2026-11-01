/**
 * Member accounts: someone on a roster (a youth, an adult in the Coptic
 * course) registers, an administrator links the account to their own member
 * record, and the member then sees their groups, their next meetings and the
 * homework of their stages, and ticks it off themselves. The demo clock is
 * frozen at Sunday 8 November 2026.
 */
import { describe, expect, test } from "vitest"

import { isActiveAccount, isMember, isParent, isStaff } from "@/lib/domain/policy"
import type { User } from "@/lib/domain/types"
import { hasMemberPortal } from "@/lib/view-models"
import { ProblemError } from "@/server/errors"
import { getHomeworkProgress } from "@/server/queries/learning"
import { getMemberHome, getMemberHomework, getMemberHomeworkDetail } from "@/server/queries/member"
import { viewerInfo } from "@/server/queries/present"
import { contextFor } from "@/test/context"

import {
  approveAccount,
  authenticate,
  register,
  unlinkMember,
  type RegistrationInput,
} from "./commands/accounts"
import { completeHomework, undoCompletion } from "./commands/learning"
import { seed } from "./seed"

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
  const user = (email: string) => s.users.find((u) => u.email === email)!
  const person = (first: string, last: string) =>
    s.persons.filter((p) => p.firstName === first && p.lastName === last)
  const homework = (title: string) => s.homework.find((h) => h.title === title)!
  const level1 = s.stages.find((x) => x.name === "Level 1")!
  return {
    s,
    admin: user("mariam.fahmy@example.org"),
    irene: user("irene.wahba@example.org"), // service leader, Coptic Language Course
    nevine: user("nevine.boulos@example.org"), // member account: Bible Study, Coptic › Level 1
    hoda: user("hoda.farag@example.org"), // parent, and a member of Level 1 herself
    nevinePerson: person("Nevine", "Boulos")[0],
    hodaPerson: person("Hoda", "Farag")[0],
    // Two people called Mina Hanna: a child in 3rd Class and a youth.
    minas: person("Mina", "Hanna"),
    level1,
    letters: homework("Write the first eight letters"),
    greeting: homework("Say the Easter greeting at home"),
    words: homework("Read five short words"), // a draft
    drawSheep: homework("Draw the shepherd and his sheep"), // 3rd Class
  }
}

const mina: RegistrationInput = {
  firstName: "Mina",
  lastName: "Hanna",
  email: "mina.hanna.youth@example.org",
  password: "a long enough password",
  as: "member",
  details: "Youth Meeting on Fridays and the Deacons’ School",
  language: "de",
  acceptPrivacy: true,
}

describe("member accounts", () => {
  test("members say which groups they take part in", () => {
    const t = demo()
    const problem = problemOf(() => register(t.s, { ...mina, details: " " }))
    expect(problem?.fieldErrors).toHaveProperty("details")
  })

  test("approval links the account to the chosen record, with the age check", () => {
    const t = demo()
    const user = register(t.s, mina)
    const youth = t.minas.find((p) =>
      t.s.memberships.some((m) => m.personId === p.id && m.stageId === null)
    )!
    approveAccount(t.s, t.admin, user.id, {
      as: "member",
      personId: youth.id,
      ageCheck: "guardianConsent",
      guardianConsentNote: "His mother agreed in person on 8 November.",
    })
    expect(user.personId).toBe(youth.id)
    expect(user.roleIds).toEqual([])
    expect(user.registration).toBeNull()
    expect(user.guardianConsentNote).toBe("His mother agreed in person on 8 November.")
    expect(isMember(user) && isActiveAccount(user)).toBe(true)
    expect(authenticate(t.s, mina.email, mina.password).ok).toBe(true)
  })

  test("the administrator chooses the record and answers the age question", () => {
    const t = demo()
    const user = register(t.s, mina)
    const problem = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, { as: "member", personId: null, ageCheck: null })
    )
    expect(Object.keys(problem?.fieldErrors ?? {}).sort()).toEqual(["ageCheck", "personId"])
    expect(user.approvedAt).toBeNull()
  })

  test("a record belongs to at most one account", () => {
    const t = demo()
    const user = register(t.s, mina)
    const problem = problemOf(() =>
      approveAccount(t.s, t.admin, user.id, {
        as: "member",
        personId: t.hodaPerson.id,
        ageCheck: "sixteenOrOlder",
      })
    )
    expect(problem?.fieldErrors).toHaveProperty("personId")
  })

  test("only administrators approve members and remove links", () => {
    const t = demo()
    const user = register(t.s, mina)
    const approve = () =>
      approveAccount(t.s, t.irene, user.id, {
        as: "member",
        personId: t.minas[1].id,
        ageCheck: "sixteenOrOlder",
      })
    expect(problemOf(approve)?.status).toBe(403)
    expect(problemOf(() => unlinkMember(t.s, t.irene, t.nevine.id))?.status).toBe(403)
  })

  test("removing the link sends a member-only account back to the requests", () => {
    const t = demo()
    unlinkMember(t.s, t.admin, t.nevine.id)
    expect(t.nevine.personId).toBeNull()
    expect(t.nevine.approvedAt).toBeNull()
    expect(t.nevine.registration?.as).toBe("member")
    expect(authenticate(t.s, t.nevine.email, "khmk-demo")).toEqual({ ok: false, reason: "pending" })
  })

  test("staff and parents get the member portal while their own record is in a group", () => {
    const t = demo()
    const portal = (u: User) => hasMemberPortal(viewerInfo(contextFor(t.s, u), u))
    const daniel = t.s.users.find((u) => u.email === "daniel.michael@example.org")!
    const parentOnly = t.s.users.find((u) => u.personId === null && isParent(u) && !isStaff(u))!
    expect(portal(t.nevine)).toBe(true)
    expect(portal(t.hoda)).toBe(true) // Bible Study and Level 1
    expect(portal(daniel)).toBe(true) // Servants' Preparation
    expect(portal(parentOnly)).toBe(false)
    for (const m of t.s.memberships.filter((m) => m.personId === daniel.personId)) {
      m.endsOn = "2026-11-01"
    }
    expect(portal(daniel)).toBe(false)
  })

  test("a parent keeps the parent portal when the link to their own record is removed", () => {
    const t = demo()
    unlinkMember(t.s, t.admin, t.hoda.id)
    expect(t.hoda.personId).toBeNull()
    expect(isActiveAccount(t.hoda)).toBe(true)
    expect(t.hoda.roleIds.map((id) => t.s.roles.find((r) => r.id === id)?.name)).toEqual(["Parent"])
  })
})

describe("member portal", () => {
  test("the home shows the member's groups and last lesson", async () => {
    const t = demo()
    const home = await getMemberHome(contextFor(t.s, t.nevine))
    expect(home.groups.map((g) => g.stage?.name ?? g.service.name)).toEqual([
      "Bible Study",
      "Level 1",
    ])
    const level1 = home.groups.find((g) => g.stage?.id === t.level1.id)!
    expect(level1.lastLesson?.title).toBe("The first eight letters")
    expect(level1.schedules.map((s) => s.name)).toEqual(["Level 1 class"])
  })

  test("the next meetings are those of the member's groups, soonest first", async () => {
    const t = demo()
    const home = await getMemberHome(contextFor(t.s, t.nevine))
    expect(home.meetings.length).toBeGreaterThan(0)
    expect(home.meetings[0]).toMatchObject({ date: "2026-11-09", group: "Level 1" })
    expect(new Set(home.meetings.map((m) => m.group))).toEqual(new Set(["Bible Study", "Level 1"]))
    const dates = home.meetings.map((m) => `${m.date} ${m.startTime}`)
    expect(dates).toEqual([...dates].sort())
  })

  test("members see the published homework of their stages, never drafts or other stages", async () => {
    const t = demo()
    const ctx = contextFor(t.s, t.nevine)
    const list = await getMemberHomework(ctx)
    expect(list.toDo.map((x) => x.title)).toEqual(["Write the first eight letters"])
    expect(list.done.map((x) => x.title)).toEqual(["Say the Easter greeting at home"])
    expect(list.done[0].completedByYou).toBe(true)
    expect(await getMemberHomeworkDetail(ctx, t.words.id)).toBeNull()
    expect(await getMemberHomeworkDetail(ctx, t.drawSheep.id)).toBeNull()
    const detail = await getMemberHomeworkDetail(ctx, t.letters.id)
    expect(detail?.resources[0].url).toBe("https://example.org/coptic-alphabet")
  })

  test("members tick off their own homework, and only their own", () => {
    const t = demo()
    const report = completeHomework(t.s, t.nevine, t.letters.id, t.nevinePerson.id)
    expect(report.completedBy).toBe(t.nevine.id)
    expect(completeHomework(t.s, t.nevine, t.letters.id, t.nevinePerson.id).id).toBe(report.id)
    expect(
      problemOf(() => completeHomework(t.s, t.nevine, t.letters.id, t.hodaPerson.id))?.status
    ).toBe(403)
    expect(undoCompletion(t.s, t.nevine, t.letters.id, t.nevinePerson.id)?.undoneBy).toBe(
      t.nevine.id
    )
  })

  test("servants see who reported with their own account, and who has no account", async () => {
    const t = demo()
    completeHomework(t.s, t.hoda, t.letters.id, t.hodaPerson.id)
    const progress = await getHomeworkProgress(
      contextFor(t.s, t.irene),
      t.level1.serviceId,
      t.level1.id,
      t.letters.id
    )
    if (!progress || progress.forbidden) throw new Error("Irene leads the Coptic course")
    const hoda = progress.rows.find((r) => r.person.id === t.hodaPerson.id)!
    expect(hoda).toMatchObject({ status: "completed", reportedBySelf: true, ownAccount: true })
    const nevine = progress.rows.find((r) => r.person.id === t.nevinePerson.id)!
    expect(nevine).toMatchObject({ status: "not-completed", ownAccount: true })
    // The children of the course have neither a parent account nor one of their own.
    const withoutAccount = progress.rows.filter((r) => r.parentAccounts === 0 && !r.ownAccount)
    expect(progress.homework.counts?.withoutAccount).toBe(withoutAccount.length)
    expect(withoutAccount.length).toBe(6)
  })
})
