import { describe, expect, test } from "vitest"

import { planDates, ruleProblems } from "./planning"
import type { PlanRule } from "./types"

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

describe("annual planning", () => {
  test("without a first or last date, the plan covers the whole calendar year", () => {
    const dates = planDates(sundays, 2027)

    expect(dates).toHaveLength(52)
    expect(dates[0]).toBe("2027-01-03")
    expect(dates.at(-1)).toBe("2027-12-26")
  })

  test("the optional first and last dates narrow the year", () => {
    const dates = planDates({ ...sundays, startsOn: "2027-09-01", endsOn: "2028-06-30" }, 2027)

    expect(dates[0]).toBe("2027-09-05")
    expect(dates.at(-1)).toBe("2027-12-26")
  })

  test("every other week counts from the first date", () => {
    const dates = planDates({ ...sundays, interval: 2, startsOn: "2027-01-10" }, 2027)

    expect(dates.slice(0, 3)).toEqual(["2027-01-10", "2027-01-24", "2027-02-07"])
  })

  test("a monthly plan meets on the chosen week of the month", () => {
    const dates = planDates({ ...sundays, frequency: "monthly", weekday: 6, monthWeek: 1 }, 2027)

    expect(dates.slice(0, 2)).toEqual(["2027-01-02", "2027-02-06"])
  })

  test("the end time is optional and checked only when given", () => {
    expect(ruleProblems(sundays, 2027)).toEqual({})
    expect(ruleProblems({ ...sundays, endTime: "11:00" }, 2027)).toEqual({
      endTime: "endBeforeStart",
    })
  })

  test("the last date may not come before the first", () => {
    expect(
      ruleProblems({ ...sundays, startsOn: "2027-05-01", endsOn: "2027-04-01" }, 2027)
    ).toEqual({ endsOn: "lastBeforeFirst" })
  })
})
