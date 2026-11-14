import { describe, expect, test } from "vitest"

import { ROLE_IDS } from "@/lib/domain/policy"
import type { PlanRule } from "@/lib/domain/types"
import { ProblemError } from "@/server/errors"
import { accountNamed, contextFor } from "@/test/context"

import { assignRole } from "./commands/access"
import { setDaysOffMode, toggleDayOff } from "./commands/calendar"
import {
  addOneOffSession,
  cancelSession,
  changePlan,
  discardDraft,
  rescheduleSession,
  savePlan,
} from "./commands/schedule"
import { automaticDays, daysOffOf, occasionHits } from "./scheduling"
import { seed } from "./seed"

const sundays: PlanRule = {
  frequency: "weekly",
  interval: 1,
  weekday: 7,
  monthWeek: null,
  startTime: "12:00",
  endTime: null,
  startsOn: null,
  endsOn: null,
  location: null,
}

const fail = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProblemError) {
      return error.problem.detail?.key ?? error.problem.status
    }

    throw error
  }

  return "ok"
}

function setUp() {
  const s = seed("church")
  const sundaySchool = s.services.find((x) => x.name === "Sunday School")!
  const youth = s.services.find((x) => x.name === "Youth Gathering")!
  const schedules = s.schedules.filter((x) => x.serviceId === sundaySchool.id)
  const youthSchedule = s.schedules.find((x) => x.serviceId === youth.id)!

  return { s, sundaySchool, youth, schedules, youthSchedule }
}

describe("annual plans", () => {
  test("confirming a plan creates the whole year at once, with suggested days canceled", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const before = s.sessions.length
    const result = savePlan(christine, {
      scheduleId: schedules[0].id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: true,
    })
    const created = s.sessions.filter(
      (x) => x.scheduleId === schedules[0].id && x.date.startsWith("2027-")
    )

    expect(result.created).toBe(52)
    expect(s.sessions.length).toBe(before + 52)
    expect(created.find((x) => x.date === "2027-05-02")?.status).toBe("canceled")
    expect(created.find((x) => x.date === "2027-06-27")?.status).toBe("canceled")
    expect(created.find((x) => x.date === "2027-12-26")?.status).toBe("canceled")
    expect(created.find((x) => x.date === "2027-01-03")?.status).toBe("scheduled")
  })

  test("a plan is confirmed only once, so no session is created twice", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const input = {
      scheduleId: schedules[0].id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: true,
    }
    savePlan(christine, input)
    const count = s.sessions.length

    expect(fail(() => savePlan(christine, { ...input, version: 1 }))).toBe(
      "errors.plans.alreadyConfirmed"
    )
    expect(s.sessions.length).toBe(count)
  })

  test("an outdated draft can't be confirmed", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const input = {
      scheduleId: schedules[0].id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: false,
    }
    savePlan(christine, input)
    savePlan(christine, { ...input, version: 1 })

    expect(fail(() => savePlan(christine, { ...input, version: 1, confirm: true }))).toBe(
      "errors.plans.stale"
    )
  })

  test("a draft discarded meanwhile can't be saved over", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const input = {
      scheduleId: schedules[0].id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: false,
    }
    savePlan(christine, input)
    discardDraft(christine, schedules[0].id, 2027)

    expect(fail(() => savePlan(christine, { ...input, version: 1 }))).toBe("errors.plans.stale")
  })

  test("the end time and the last date stay empty when not given", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    savePlan(christine, {
      scheduleId: schedules[1].id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: true,
    })
    const plan = s.plans.find((p) => p.scheduleId === schedules[1].id && p.year === 2027)!

    expect(plan.rule.endTime).toBeNull()
    expect(plan.rule.endsOn).toBeNull()
    expect(s.sessions.filter((x) => x.planId === plan.id).every((x) => x.endTime === null)).toBe(
      true
    )
  })

  test("only an administrator keeps a session on a day the church canceled everywhere", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))

    expect(
      fail(() =>
        savePlan(christine, {
          scheduleId: schedules[0].id,
          year: 2027,
          rule: sundays,
          decisions: { "2027-06-27": "keep" },
          version: null,
          confirm: false,
        })
      )
    ).toBe("errors.plans.mandatoryException")
  })

  test("changing a plan from a date keeps sessions with attendance and changes made by hand", () => {
    const { s, youthSchedule } = setUp()
    const mark = contextFor(s, accountNamed(s, "mark.shenouda"))
    const plan = s.plans.find((p) => p.scheduleId === youthSchedule.id && p.year === 2026)!
    const moved = s.sessions.find(
      (x) => x.scheduleId === youthSchedule.id && x.date === "2026-11-13"
    )!
    const outcome = changePlan(mark, {
      scheduleId: youthSchedule.id,
      year: 2026,
      from: "2026-11-09",
      rule: { ...plan.rule, weekday: 6, startTime: "18:00" },
      version: plan.version,
      dryRun: false,
    })

    expect(outcome.kept.map((x) => x.id)).toContain(moved.id)
    expect(s.sessions.find((x) => x.id === moved.id)?.startTime).toBe("20:00")
    expect(
      s.sessions.some(
        (x) =>
          x.scheduleId === youthSchedule.id && x.date === "2026-11-14" && x.startTime === "18:00"
      )
    ).toBe(true)
    expect(
      s.sessions
        .filter((x) => x.scheduleId === youthSchedule.id && x.date < "2026-11-08")
        .every((x) => x.status === "closed")
    ).toBe(true)
  })
})

describe("single sessions", () => {
  test("one session is canceled, moved or added without touching the plan", () => {
    const { s, schedules } = setUp()
    const christine = contextFor(s, accountNamed(s, "christine.adel"))
    const third = schedules.find(
      (x) => s.stages.find((st) => st.id === x.stageId)?.name === "1st Class"
    )!
    const next = s.sessions.find((x) => x.scheduleId === third.id && x.date === "2026-11-15")!
    cancelSession(christine, next.id, "Church cleaning")
    const later = s.sessions.find((x) => x.scheduleId === third.id && x.date === "2026-11-22")!
    rescheduleSession(christine, later.id, {
      date: "2026-11-21",
      startTime: "16:00",
      endTime: null,
      location: "Hall",
    })
    const oneOff = addOneOffSession(christine, third.id, {
      date: "2026-12-19",
      startTime: "15:00",
      endTime: "17:00",
      location: null,
    })

    expect(next.status).toBe("canceled")
    expect(later.originalDate).toBe("2026-11-22")
    expect(oneOff.kind).toBe("oneOff")
    expect(s.plans.find((p) => p.scheduleId === third.id && p.year === 2026)?.version).toBe(1)
  })

  test("a role scoped to Sunday School plans only Sunday School", () => {
    const { s, schedules, youthSchedule } = setUp()
    const mariam = contextFor(s, accountNamed(s, "mariam.fahmy"))
    const daniel = contextFor(s, accountNamed(s, "daniel.michael"))
    const sundaySchool = schedules[0].serviceId
    const third = schedules.find(
      (x) => s.stages.find((st) => st.id === x.stageId)?.name === "1st Class"
    )!
    const input = (id: string) => ({
      scheduleId: id,
      year: 2027,
      rule: sundays,
      decisions: {},
      version: null,
      confirm: false,
    })

    expect(fail(() => savePlan(daniel, input(third.id)))).toBe("errors.forbidden")
    expect(fail(() => savePlan(daniel, input(schedules[0].id)))).toBe("errors.notFound.schedule")
    assignRole(mariam, daniel.viewer.id, ROLE_IDS.serviceLeader, {
      type: "service",
      id: sundaySchool,
    })
    expect(fail(() => savePlan(daniel, input(schedules[0].id)))).toBe("ok")
    expect(fail(() => savePlan(daniel, input(youthSchedule.id)))).toBe("errors.forbidden")
  })
})

describe("days without sessions", () => {
  test("the system chooses the major feasts from the checked calendar", () => {
    const { s, youth } = setUp()

    expect(automaticDays(s, youth.id, 2027)).toEqual(
      expect.arrayContaining(["2027-04-30", "2027-05-02"])
    )
    expect(automaticDays(s, youth.id, 2028)).toEqual([])
  })

  test("marking a day by hand switches to hand-picked days, starting from the system's", () => {
    const { s, youth } = setUp()
    const mark = contextFor(s, accountNamed(s, "mark.shenouda"))
    toggleDayOff(mark, youth.id, "2027-01-01")

    expect(daysOffOf(s, youth.id, 2027)).toEqual({
      mode: "custom",
      days: expect.arrayContaining(["2027-01-01", "2027-04-30"]),
    })
    expect(occasionHits(s, youth.id, 2027)["2027-01-01"]?.[0].mode).toBe("suggested")
    setDaysOffMode(mark, youth.id, 2027, "automatic")
    expect(daysOffOf(s, youth.id, 2027).days).not.toContain("2027-01-01")
  })

  test("a servant without planning rights can't change the days", () => {
    const { s, youth } = setUp()
    const daniel = contextFor(s, accountNamed(s, "daniel.michael"))

    expect(fail(() => toggleDayOff(daniel, youth.id, "2027-01-01"))).toBe("errors.forbidden")
  })
})
