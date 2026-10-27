/**
 * The rules of the lesson, homework and parent portal brief, checked against
 * the mock backend layer (the same commands and read models the server
 * actions and pages use). The demo clock is frozen at Sunday 8 November 2026.
 */
import { describe, expect, test } from "vitest"

import { can } from "@/lib/domain/policy"
import type { User } from "@/lib/domain/types"
import { ProblemError } from "@/server/errors"
import {
  getParentChildren,
  getParentHomework,
  getParentHomeworkDetail,
} from "@/server/queries/parent"
import { contextFor } from "@/test/context"

import {
  approveGuardian,
  archiveHomework,
  completeHomework,
  createHomework,
  createLesson,
  linkGuardian,
  publishHomework,
  setLessonStatus,
  undoCompletion,
  unpublishHomework,
} from "./commands/learning"
import { seed } from "./seed"
import { childrenOf, currentCompletion } from "./selectors"
import type { State } from "./state"

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
  const person = (first: string, last: string) =>
    s.persons.find((p) => p.firstName === first && p.lastName === last)!
  const stage = (name: string) => s.stages.find((st) => st.name === name)!
  return {
    s,
    admin: user("mariam.fahmy@example.org"),
    leader: user("christine.adel@example.org"), // service leader, Sunday School
    daniel: user("daniel.michael@example.org"), // servant, Sunday School › 3rd Class
    hoda: user("hoda.farag@example.org"), // parent of Mina (3rd Class) and Mimi (1st Class)
    nabil: user("nabil.hanna@example.org"), // the other parent of Mina and Mimi
    nadia: user("nadia.mansour@example.org"), // asked for access to Sophia; not approved yet
    mina: person("Mina", "Hanna"),
    kiro: person("Kirollos", "Iskander"), // 3rd Class, another family
    c1: stage("1st Class"),
    c3: stage("3rd Class"),
  }
}
type Demo = ReturnType<typeof demo>

const as = (s: State, viewer: User) => contextFor(s, viewer)

/** Daniel prepares “The Good Samaritan” for Sunday 15 November and assigns the memory verse. */
function goodSamaritan(t: Demo, { publish = true } = {}) {
  const lesson = createLesson(t.s, t.daniel, t.c3.id, {
    title: "The Good Samaritan",
    meeting: "date:2026-11-15",
    passage: "Luke 10:25–37",
    memoryVerse: "You shall love the Lord your God … and your neighbour as yourself. (Luke 10:27)",
    notes: "Kiro likes to act; give him the role of the innkeeper.",
    responsibleId: t.daniel.id,
  })
  const homework = createHomework(
    t.s,
    t.daniel,
    lesson.id,
    {
      title: "Learn the memory verse",
      instructions: "Say Luke 10:27 by heart.",
      dueDate: "2026-11-22",
    },
    publish
  )
  return { lesson, homework }
}

describe("roles", () => {
  test("a servant prepares lessons only for the stage they serve in", () => {
    const t = demo()
    expect(can(t.daniel, "MANAGE_LESSONS", t.c3.serviceId, t.c3.id)).toBe(true)
    expect(can(t.daniel, "MANAGE_LESSONS", t.c1.serviceId, t.c1.id)).toBe(false)
    const elsewhere = () =>
      createLesson(t.s, t.daniel, t.c1.id, {
        title: "Noah’s ark",
        meeting: "date:2026-11-15",
        responsibleId: t.daniel.id,
      })
    expect(statusOf(elsewhere)).toBe(403)
  })

  test("the service leader covers every stage of the service", () => {
    const t = demo()
    expect(can(t.leader, "MANAGE_HOMEWORK", t.c1.serviceId, t.c1.id)).toBe(true)
    expect(can(t.leader, "MANAGE_HOMEWORK", t.c3.serviceId, t.c3.id)).toBe(true)
  })

  test("parents hold no staff permission", () => {
    const t = demo()
    expect(can(t.hoda, "VIEW_SERVICE", t.c3.serviceId)).toBe(false)
    const lesson = () =>
      createLesson(t.s, t.hoda, t.c3.id, {
        title: "Zacchaeus",
        meeting: "date:2026-11-15",
        responsibleId: t.daniel.id,
      })
    expect(statusOf(lesson)).toBe(403)
  })
})

describe("homework in the parent portal", () => {
  test("drafts never reach parents; published homework does, until it is archived", async () => {
    const t = demo()
    const { homework } = goodSamaritan(t, { publish: false })
    const visible = async () =>
      (await getParentHomework(as(t.s, t.hoda), t.mina.id)).toDo.map((x) => x.id)

    expect(await visible()).not.toContain(homework.id)
    expect(await getParentHomeworkDetail(as(t.s, t.hoda), homework.id, t.mina.id)).toBeNull()

    publishHomework(t.s, t.daniel, homework.id)
    expect(await visible()).toContain(homework.id)

    archiveHomework(t.s, t.daniel, homework.id)
    expect(await visible()).not.toContain(homework.id)
  })

  test("parents see their own children only, and only once the access is approved", async () => {
    const t = demo()
    expect(childrenOf(t.s, t.hoda.id).map((p) => p.firstName)).toEqual(["Mariam", "Mina"])

    const waiting = await getParentChildren(as(t.s, t.nadia))
    expect(waiting.children).toEqual([])
    expect(waiting.pendingAccess).toBe(1)
    const request = t.s.guardians.find((g) => g.userId === t.nadia.id && g.status === "pending")!
    approveGuardian(t.s, t.admin, request.id)
    expect((await getParentChildren(as(t.s, t.nadia))).children.map((c) => c.name)).toEqual([
      "Sophia",
    ])
  })

  test("a parent can't open or report homework for another family's child", async () => {
    const t = demo()
    const { homework } = goodSamaritan(t)
    // Kiro is in the same class as Mina, but Hoda is not his guardian.
    expect(await getParentHomeworkDetail(as(t.s, t.hoda), homework.id, t.kiro.id)).toBeNull()
    expect(statusOf(() => completeHomework(t.s, t.hoda, homework.id, t.kiro.id))).toBe(403)
  })

  test("the servants’ notes stay out of what parents receive", async () => {
    const t = demo()
    const { homework } = goodSamaritan(t)
    const detail = await getParentHomeworkDetail(as(t.s, t.hoda), homework.id, t.mina.id)
    expect(detail?.lesson.passage).toBe("Luke 10:25–37")
    expect(JSON.stringify(detail)).not.toContain("innkeeper")
  })
})

describe("completion", () => {
  test("reporting twice keeps the first report, so double taps and retries are safe", () => {
    const t = demo()
    const { homework } = goodSamaritan(t)
    const first = completeHomework(t.s, t.hoda, homework.id, t.mina.id)
    const again = completeHomework(t.s, t.hoda, homework.id, t.mina.id)
    expect(again.id).toBe(first.id)
    expect(t.s.completions.filter((c) => c.assignmentId === homework.id)).toHaveLength(1)
  })

  test("undo keeps the history, and either parent can report it again", () => {
    const t = demo()
    const { homework } = goodSamaritan(t)
    completeHomework(t.s, t.hoda, homework.id, t.mina.id)
    undoCompletion(t.s, t.hoda, homework.id, t.mina.id)
    expect(currentCompletion(t.s, homework.id, t.mina.id)).toBeUndefined()

    const again = completeHomework(t.s, t.nabil, homework.id, t.mina.id)
    expect(again.completedBy).toBe(t.nabil.id)
    expect(t.s.completions.filter((c) => c.assignmentId === homework.id)).toHaveLength(2)
  })

  test("a draft can't be reported done", () => {
    const t = demo()
    const { homework } = goodSamaritan(t, { publish: false })
    expect(statusOf(() => completeHomework(t.s, t.hoda, homework.id, t.mina.id))).toBe(404)
  })

  test("homework parents reported done can't go back to draft", () => {
    const t = demo()
    const { homework } = goodSamaritan(t)
    completeHomework(t.s, t.hoda, homework.id, t.mina.id)
    expect(statusOf(() => unpublishHomework(t.s, t.daniel, homework.id))).toBe(409)
  })
})

describe("lessons and parent access", () => {
  test("a lesson is marked as taught on or after its date, not before", () => {
    const t = demo()
    const { lesson } = goodSamaritan(t)
    expect(statusOf(() => setLessonStatus(t.s, t.daniel, lesson.id, "completed"))).toBe(409)
    expect(setLessonStatus(t.s, t.daniel, lesson.id, "ready").status).toBe("ready")
  })

  test("only administrators give a parent access to a child", () => {
    const t = demo()
    expect(statusOf(() => linkGuardian(t.s, t.leader, t.hoda.id, t.kiro.id))).toBe(403)
    linkGuardian(t.s, t.admin, t.hoda.id, t.kiro.id)
    expect(childrenOf(t.s, t.hoda.id).map((p) => p.firstName)).toContain("Kirollos")
  })
})
