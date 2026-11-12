import { addDays } from "./time"
import type { LocalDate, OccasionCategory } from "./types"

const COPTIC_EPOCH = 1825030

function julianDayToDate(jd: number): LocalDate {
  const a = jd + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  const day = e - Math.floor((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * Math.floor(m / 10)
  const year = 100 * b + d - 4800 + Math.floor(m / 10)

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function copticToGregorian(copticYear: number, month: number, day: number): LocalDate {
  const startOfYear = COPTIC_EPOCH + 365 * (copticYear - 1) + Math.floor(copticYear / 4)

  return julianDayToDate(startOfYear + 30 * (month - 1) + day - 1)
}

export function orthodoxEaster(year: number): LocalDate {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  const julian = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  return addDays(julian, 13)
}

export function westernEaster(year: number): LocalDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

type Rule =
  | { kind: "coptic"; month: number; day: number }
  | { kind: "easter"; offset: number }
  | { kind: "western"; offset: number }
  | { kind: "gregorian"; month: number; day: number }

export const AUTOMATIC_CATEGORIES: OccasionCategory[] = ["lordsMajorFeast", "holyWeek"]

export type OccasionRule = { key: string; category: OccasionCategory; rule: Rule }

export const OCCASION_RULES: OccasionRule[] = [
  { key: "nativity", category: "lordsMajorFeast", rule: { kind: "gregorian", month: 1, day: 7 } },
  { key: "theophany", category: "lordsMajorFeast", rule: { kind: "coptic", month: 5, day: 11 } },
  { key: "annunciation", category: "lordsMajorFeast", rule: { kind: "coptic", month: 7, day: 29 } },
  { key: "palmSunday", category: "lordsMajorFeast", rule: { kind: "easter", offset: -7 } },
  { key: "easter", category: "lordsMajorFeast", rule: { kind: "easter", offset: 0 } },
  { key: "ascension", category: "lordsMajorFeast", rule: { kind: "easter", offset: 39 } },
  { key: "pentecost", category: "lordsMajorFeast", rule: { kind: "easter", offset: 49 } },
  { key: "circumcision", category: "lordsMinorFeast", rule: { kind: "coptic", month: 5, day: 6 } },
  { key: "cana", category: "lordsMinorFeast", rule: { kind: "coptic", month: 5, day: 13 } },
  {
    key: "entryIntoTemple",
    category: "lordsMinorFeast",
    rule: { kind: "coptic", month: 6, day: 8 },
  },
  { key: "thomasSunday", category: "lordsMinorFeast", rule: { kind: "easter", offset: 7 } },
  {
    key: "entryIntoEgypt",
    category: "lordsMinorFeast",
    rule: { kind: "coptic", month: 9, day: 24 },
  },
  {
    key: "transfiguration",
    category: "lordsMinorFeast",
    rule: { kind: "coptic", month: 12, day: 13 },
  },
  { key: "holyThursday", category: "holyWeek", rule: { kind: "easter", offset: -3 } },
  { key: "goodFriday", category: "holyWeek", rule: { kind: "easter", offset: -2 } },
  { key: "holySaturday", category: "holyWeek", rule: { kind: "easter", offset: -1 } },
  { key: "apostles", category: "otherFeast", rule: { kind: "coptic", month: 11, day: 5 } },
  { key: "assumption", category: "otherFeast", rule: { kind: "coptic", month: 12, day: 16 } },
  { key: "nayrouz", category: "otherFeast", rule: { kind: "coptic", month: 1, day: 1 } },
  { key: "feastOfTheCross", category: "otherFeast", rule: { kind: "coptic", month: 1, day: 17 } },
  { key: "newYear", category: "publicHoliday", rule: { kind: "gregorian", month: 1, day: 1 } },
  { key: "westernGoodFriday", category: "publicHoliday", rule: { kind: "western", offset: -2 } },
  { key: "easterMonday", category: "publicHoliday", rule: { kind: "western", offset: 1 } },
  { key: "labourDay", category: "publicHoliday", rule: { kind: "gregorian", month: 5, day: 1 } },
  { key: "westernAscension", category: "publicHoliday", rule: { kind: "western", offset: 39 } },
  { key: "whitMonday", category: "publicHoliday", rule: { kind: "western", offset: 50 } },
  { key: "corpusChristi", category: "publicHoliday", rule: { kind: "western", offset: 60 } },
  { key: "germanUnity", category: "publicHoliday", rule: { kind: "gregorian", month: 10, day: 3 } },
  { key: "allSaints", category: "publicHoliday", rule: { kind: "gregorian", month: 11, day: 1 } },
  {
    key: "christmasDay",
    category: "publicHoliday",
    rule: { kind: "gregorian", month: 12, day: 25 },
  },
  { key: "boxingDay", category: "publicHoliday", rule: { kind: "gregorian", month: 12, day: 26 } },
]

function datesOf(rule: Rule, year: number): LocalDate[] {
  switch (rule.kind) {
    case "gregorian":
      return [`${year}-${String(rule.month).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`]
    case "easter":
      return [addDays(orthodoxEaster(year), rule.offset)]
    case "western":
      return [addDays(westernEaster(year), rule.offset)]
    case "coptic":
      return [year - 284, year - 283]
        .map((copticYear) => copticToGregorian(copticYear, rule.month, rule.day))
        .filter((date) => date.startsWith(`${year}-`))
  }
}

export type ComputedOccasion = { key: string; category: OccasionCategory; date: LocalDate }

export function computeOccasions(year: number): ComputedOccasion[] {
  return OCCASION_RULES.flatMap(({ key, category, rule }) =>
    datesOf(rule, year).map((date) => ({ key, category, date }))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
}
