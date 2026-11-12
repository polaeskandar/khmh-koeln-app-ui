import { describe, expect, test } from "vitest"

import { computeOccasions, copticToGregorian, orthodoxEaster, westernEaster } from "./calendar"

describe("the Coptic calendar", () => {
  test("Orthodox Easter follows the Julian computus", () => {
    expect(orthodoxEaster(2026)).toBe("2026-04-12")
    expect(orthodoxEaster(2027)).toBe("2027-05-02")
    expect(orthodoxEaster(2028)).toBe("2028-04-16")
  })

  test("Western Easter for the German public holidays", () => {
    expect(westernEaster(2027)).toBe("2027-03-28")
  })

  test("1 Tout is 11 September, or 12 September before a Gregorian leap year", () => {
    expect(copticToGregorian(1743, 1, 1)).toBe("2026-09-11")
    expect(copticToGregorian(1744, 1, 1)).toBe("2027-09-12")
  })

  test("the 2027 feasts match the published table of copticchurch.net", () => {
    const dates = Object.fromEntries(computeOccasions(2027).map((o) => [o.key, o.date]))

    expect(dates).toMatchObject({
      nativity: "2027-01-07",
      circumcision: "2027-01-14",
      theophany: "2027-01-19",
      cana: "2027-01-21",
      entryIntoTemple: "2027-02-15",
      annunciation: "2027-04-07",
      palmSunday: "2027-04-25",
      goodFriday: "2027-04-30",
      easter: "2027-05-02",
      thomasSunday: "2027-05-09",
      entryIntoEgypt: "2027-06-01",
      ascension: "2027-06-10",
      pentecost: "2027-06-20",
      apostles: "2027-07-12",
      transfiguration: "2027-08-19",
      assumption: "2027-08-22",
      nayrouz: "2027-09-12",
      feastOfTheCross: "2027-09-28",
    })
  })

  test("a fixed feast falls once in a year", () => {
    expect(computeOccasions(2027).filter((o) => o.key === "nayrouz")).toHaveLength(1)
  })
})
