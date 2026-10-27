import { describe, expect, test } from "vitest"

import { addDays } from "./domain/time"
import type { Recurrence } from "./domain/types"
import { formatFor } from "./format"

const en = formatFor("en")
const de = formatFor("de")
const ar = formatFor("ar")

describe("dates are spelled out the same on server and client", () => {
  test("English names without Intl", () => {
    expect(en.longDate("2026-11-08")).toBe("Sunday 8 November 2026")
    expect(en.mediumDate("2026-11-08")).toBe("Sun 8 Nov 2026")
    expect(en.dayMonth("2026-11-22")).toBe("Sun 22 Nov")
    expect(en.shortDate("2026-09-01")).toBe("1 Sep")
  })

  test("German: ordinal dots and a comma after the weekday", () => {
    expect(de.longDate("2026-11-08")).toBe("Sonntag, 8. November 2026")
    expect(de.mediumDate("2026-11-08")).toBe("So., 8. Nov. 2026")
    expect(de.dayMonth("2026-03-22")).toBe("So., 22. März")
    expect(de.shortDate("2026-09-01")).toBe("1. Sept.")
  })

  test("Arabic: Arabic month names with Western digits", () => {
    expect(ar.longDate("2026-11-08")).toBe("الأحد، 8 نوفمبر 2026")
    expect(ar.dayMonth("2026-11-22")).toBe("الأحد، 22 نوفمبر")
    expect(ar.shortDate("2026-09-01")).toBe("1 سبتمبر")
  })

  test("relative days and sentence labels", () => {
    expect(en.relativeDay("2026-11-08", "2026-11-08")).toBe("Today")
    expect(en.relativeDay("2026-11-09", "2026-11-08")).toBe("Tomorrow")
    expect(en.relativeDay("2026-11-07", "2026-11-08")).toBe("Yesterday")
    expect(en.relativeDay("2026-11-15", "2026-11-08")).toBe("Sun 15 Nov")
    expect(en.atLabel("2026-11-08T11:10:00Z", "2026-11-08")).toBe("today at 12:10")
    expect(en.atLabel("2026-11-01T12:47:00Z", "2026-11-08")).toBe("on Sun 1 Nov at 13:47")

    expect(de.relativeDay("2026-11-09", "2026-11-08")).toBe("Morgen")
    expect(de.relativeDayInline("2026-11-09", "2026-11-08")).toBe("morgen")
    expect(de.atLabel("2026-11-08T11:10:00Z", "2026-11-08")).toBe("heute um 12:10")
    expect(de.atLabel("2026-11-01T12:47:00Z", "2026-11-08")).toBe("am So., 1. Nov., um 13:47")

    expect(ar.relativeDay("2026-11-07", "2026-11-08")).toBe("أمس")
    expect(ar.atLabel("2026-11-08T11:10:00Z", "2026-11-08")).toBe("اليوم الساعة 12:10")
    expect(ar.instantLabel("2026-11-01T12:47:00Z", "2026-11-08")).toBe("الأحد، 1 نوفمبر، 13:47")
  })

  test("percentages and lists", () => {
    expect(en.percent(0.82)).toBe("82%")
    expect(de.percent(0.82)).toBe("82 %")
    expect(en.list(["Mina", "Kiro", "Sara"])).toBe("Mina, Kiro and Sara")
    expect(de.list(["Mina", "Kiro"])).toBe("Mina und Kiro")
    expect(ar.list(["مينا", "كيرو", "سارة"])).toBe("مينا، كيرو وسارة")
  })
})

describe("schedule patterns", () => {
  const dates = { startsOn: "2026-09-06", endsOn: null }
  const weekly: Recurrence = {
    frequency: "weekly",
    interval: 1,
    weekdays: [7],
    monthWeek: null,
    ...dates,
  }
  const fortnightly: Recurrence = { ...weekly, interval: 2 }
  const monthly: Recurrence = {
    frequency: "monthly",
    interval: 1,
    weekdays: [6],
    monthWeek: 1,
    ...dates,
  }
  const lastFriday: Recurrence = { ...monthly, weekdays: [5], monthWeek: -1 }

  test("in English", () => {
    expect(en.recurrence(weekly)).toBe("Every Sunday")
    expect(en.recurrence(fortnightly)).toBe("Every other Sunday")
    expect(en.recurrence({ ...weekly, weekdays: [2, 4] })).toBe("Every Tuesday and Thursday")
    expect(en.recurrence(monthly)).toBe("First Saturday of every month")
    expect(en.recurrence(lastFriday)).toBe("Last Friday of every month")
  })

  test("in German", () => {
    expect(de.recurrence(weekly)).toBe("Jeden Sonntag")
    expect(de.recurrence(fortnightly)).toBe("Jeden zweiten Sonntag")
    expect(de.recurrence(monthly)).toBe("Jeden ersten Samstag im Monat")
    expect(de.recurrence(lastFriday)).toBe("Jeden letzten Freitag im Monat")
  })

  test("in Arabic", () => {
    expect(ar.recurrence(weekly)).toBe("كل يوم أحد")
    expect(ar.recurrence(fortnightly)).toBe("الأحد كل أسبوعين")
    expect(ar.recurrence(monthly)).toBe("أول سبت من كل شهر")
    expect(ar.recurrence(lastFriday)).toBe("آخر جمعة من كل شهر")
  })
})

describe("Coptic calendar", () => {
  test("known dates", () => {
    expect(en.copticDate("2026-11-08")).toBe("29 Baba 1743 A.M.")
    // Nayrouz, the Coptic new year: 11 September, or 12 September before a Gregorian leap year.
    expect(en.copticDate("2026-09-11")).toBe("1 Tout 1743 A.M.")
    expect(en.copticDate("2027-09-12")).toBe("1 Tout 1744 A.M.")
    expect(en.copticDate("2027-09-11")).toBe("6 Nasie 1743 A.M.")
    // Coptic Christmas, 29 Kiahk.
    expect(en.copticDate("2027-01-07")).toBe("29 Kiahk 1743 A.M.")
  })

  test("in German and Arabic", () => {
    expect(de.copticDate("2026-11-08")).toBe("29. Paopi 1743 A.M.")
    expect(ar.copticDate("2026-11-08")).toBe("29 بابه 1743 ش")
    expect(ar.copticDate("2027-01-07")).toBe("29 كيهك 1743 ش")
  })

  test("agrees with ICU's Coptic calendar over twelve years", () => {
    const icu = new Intl.DateTimeFormat("en-u-ca-coptic", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    let date = "2020-01-01"
    while (date < "2032-01-01") {
      const p = icu.formatToParts(new Date(`${date}T12:00:00Z`))
      const get = (t: string) => p.find((x) => x.type === t)?.value
      expect(en.copticDate(date), date).toBe(`${get("day")} ${get("month")} ${get("year")} A.M.`)
      date = addDays(date, 1)
    }
  })
})
