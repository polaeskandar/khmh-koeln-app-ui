import { describe, expect, test } from "vitest"

import { ProblemError } from "@/server/errors"
import { getLesson, getPreparation } from "@/server/queries/learning"
import { getParentLesson, getMemberLesson } from "@/server/queries/portals"
import { accountNamed, contextFor } from "@/test/context"

import { linkChild } from "./commands/guardians"
import { createTask, deleteLesson, setLessonStatus, setTaskDone } from "./commands/learning"
import { erase } from "./commands/privacy"
import { seed } from "./seed"

const status = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      return error.problem.status
    }

    if (error instanceof Error && error.message.includes("NEXT_HTTP_ERROR_FALLBACK;404")) {
      return 404
    }

    throw error
  }

  return "ok"
}

const lessonNamed = (s: ReturnType<typeof seed>, title: string) =>
  s.lessons.find((l) => l.title === title)!
const personNamed = (s: ReturnType<typeof seed>, name: string) =>
  s.persons.find((p) => `${p.firstName} ${p.lastName}` === name)!

describe("what parents and members see of a lesson", () => {
  test("a published lesson shows its shared content, never the preparation notes", () => {
    const s = seed("church")
    const hoda = contextFor(s, accountNamed(s, "hoda.farag"))
    const mimi = personNamed(s, "Mimi Farag")
    const view = getParentLesson(hoda, lessonNamed(s, "Noah's ark").id, mimi.id)
    const json = JSON.stringify(view)

    expect(view.lesson.title).toBe("Noah's ark")
    expect(json).not.toContain("cardboard ark")
    expect(json).not.toContain("Ark craft template")
    expect(json).toContain("Children's Bible, page 18")
  })

  test("a lesson that isn't published stays hidden", () => {
    const s = seed("church")
    const hoda = contextFor(s, accountNamed(s, "hoda.farag"))
    const mimi = personNamed(s, "Mimi Farag")

    expect(
      status(() => getParentLesson(hoda, lessonNamed(s, "The Good Samaritan").id, mimi.id))
    ).toBe(404)
    setLessonStatus(
      contextFor(s, accountNamed(s, "daniel.michael")),
      lessonNamed(s, "The Good Samaritan").id,
      "published"
    )
    expect(
      status(() => getParentLesson(hoda, lessonNamed(s, "The Good Samaritan").id, mimi.id))
    ).toBe("ok")
  })

  test("parents see only their own children, members only their own groups", () => {
    const s = seed("church")
    const nadia = contextFor(s, accountNamed(s, "nadia.mansour"))
    const nevine = contextFor(s, accountNamed(s, "nevine.boulos"))

    expect(
      status(() =>
        getParentLesson(nadia, lessonNamed(s, "Noah's ark").id, personNamed(s, "Mimi Farag").id)
      )
    ).toBe(404)
    expect(status(() => getMemberLesson(nevine, lessonNamed(s, "Noah's ark").id))).toBe(404)
    expect(
      JSON.stringify(getMemberLesson(nevine, lessonNamed(s, "The first eight letters").id))
    ).not.toContain("pronunciation")
  })
})

describe("who opens a lesson", () => {
  test("lesson permissions for a stage cover its lessons, and nothing in other stages", () => {
    const s = seed("church")
    const rebecca = contextFor(s, accountNamed(s, "rebecca.habib"))
    const animals = lessonNamed(s, "God made the animals")
    const david = lessonNamed(s, "David and Goliath")
    const titles = (ctx: typeof rebecca) =>
      getPreparation(ctx).flatMap((g) => [...g.upcoming, ...g.earlier].map((l) => l.title))

    expect(getLesson(rebecca, animals.id).can.edit).toBe(true)
    expect(status(() => setLessonStatus(rebecca, animals.id, "ready"))).toBe("ok")
    expect(status(() => deleteLesson(rebecca, animals.id))).toBe(403)
    expect(titles(rebecca)).toContain("God made the animals")
    expect(status(() => getLesson(rebecca, david.id))).toBe(404)
    expect(titles(rebecca)).not.toContain("David and Goliath")
  })

  test("a service leader manages every lesson of the service", () => {
    const s = seed("church")
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const animals = lessonNamed(s, "God made the animals")

    expect(getLesson(christine, animals.id).can.edit).toBe(true)
    expect(status(() => setLessonStatus(christine, animals.id, "ready"))).toBe("ok")
    expect(
      getPreparation(christine)
        .flatMap((g) => [...g.upcoming, ...g.earlier])
        .find((l) => l.title === "God made the animals")?.responsible?.name
    ).toBe("George Nashed")
  })
})

describe("tasks", () => {
  test("a parent marks a task done for their own child only", () => {
    const s = seed("church")
    const daniel = contextFor(s, accountNamed(s, "daniel.michael"))
    const hoda = contextFor(s, accountNamed(s, "hoda.farag"))
    const task = createTask(
      daniel,
      lessonNamed(s, "Noah's ark").id,
      {
        title: "Learn Genesis 9:13",
        instructions: "Say it at home.",
        dueDate: null,
        resources: [],
      },
      true
    )
    setTaskDone(hoda, task.id, personNamed(s, "Mimi Farag").id, true)
    const other = s.persons.find(
      (p) =>
        s.memberships.some((m) => m.personId === p.id && m.stageId === task.stageId) &&
        p.lastName !== "Farag"
    )!

    expect(s.completions.filter((c) => c.taskId === task.id && c.undoneAt === null)).toHaveLength(1)
    expect(status(() => setTaskDone(hoda, task.id, other.id, true))).toBe(403)
  })

  test("a parent is linked to members only", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const hoda = accountNamed(s, "hoda.farag")

    expect(status(() => linkChild(mariam, hoda.id, personNamed(s, "Andrew Samir").id))).toBe(409)
    expect(status(() => linkChild(mariam, hoda.id, personNamed(s, "Sophia Mansour").id))).toBe("ok")
  })
})

describe("erasure", () => {
  test("erasing a person removes the account and every reference to it", () => {
    const s = seed("church")
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const sara = contextFor(s, accountNamed(s, "sara.wissa"))
    const theresa = s.dataRequests.find((r) => r.subjectName === "Theresa Wadie")!
    erase(mariam, theresa.id)

    expect(theresa.subjectName).toBeNull()
    expect(s.persons.some((p) => p.firstName === "Theresa" && p.lastName === "Wadie")).toBe(false)

    const daniel = accountNamed(s, "daniel.michael")
    const request = s.dataRequests.length
    s.dataRequests.push({
      ...theresa,
      id: "019a3f00-0000-7000-8000-00000000eeee",
      personId: daniel.personId,
      subjectName: "Daniel Michael",
      status: "open",
      outcome: null,
      closedAt: null,
      closedBy: null,
    })
    erase(sara, "019a3f00-0000-7000-8000-00000000eeee")

    expect(s.dataRequests.length).toBe(request + 1)
    expect(JSON.stringify(s)).not.toContain(daniel.id)
  })
})
