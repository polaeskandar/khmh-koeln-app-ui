import { daysBetween, daysInMonth, isoWeekday, mondayOf, addDays } from "./time"
import type { IsoWeekday, LocalDate, MonthWeek, Recurrence } from "./types"

/**
 * When a meeting schedule repeats. The backend should implement the same
 * rules, so the prototype shows the dates the real generator will create:
 *  - weekly: every N weeks on one or more weekdays ("every Sunday", "every other Monday")
 *  - monthly: every N months on the nth or last weekday ("first Saturday")
 */

/** Why a pattern is not valid; the UI shows the "errors.recurrence.<code>" message. */
export type RecurrenceProblem =
  | "interval"
  | "weekdays"
  | "weekdayRange"
  | "monthlyOneDay"
  | "monthWeek"
  | "monthWeekOnlyMonthly"
  | "endBeforeStart"

export class RecurrenceError extends Error {
  constructor(readonly code: RecurrenceProblem) {
    super(code)
  }
}

export function validateRecurrence(r: Recurrence): void {
  if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 52) {
    throw new RecurrenceError("interval")
  }
  if (r.weekdays.length === 0) throw new RecurrenceError("weekdays")
  if (r.weekdays.some((d) => d < 1 || d > 7)) throw new RecurrenceError("weekdayRange")
  if (r.frequency === "monthly") {
    if (r.weekdays.length !== 1) throw new RecurrenceError("monthlyOneDay")
    if (r.monthWeek === null || ![1, 2, 3, 4, -1].includes(r.monthWeek)) {
      throw new RecurrenceError("monthWeek")
    }
  } else if (r.monthWeek !== null) {
    throw new RecurrenceError("monthWeekOnlyMonthly")
  }
  if (r.endsOn !== null && r.endsOn < r.startsOn) throw new RecurrenceError("endBeforeStart")
}

export function normalizeWeekdays(days: number[]): IsoWeekday[] {
  return [...new Set(days)].sort((a, b) => a - b) as IsoWeekday[]
}

function monthsBetween(from: LocalDate, to: LocalDate): number {
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  return ty * 12 + tm - (fy * 12 + fm)
}

function isRequestedWeekOfMonth(date: LocalDate, monthWeek: MonthWeek): boolean {
  const dayOfMonth = Number(date.slice(8, 10))
  return monthWeek === -1
    ? dayOfMonth + 7 > daysInMonth(date)
    : Math.ceil(dayOfMonth / 7) === monthWeek
}

export function occursOn(r: Recurrence, date: LocalDate): boolean {
  if (date < r.startsOn || (r.endsOn !== null && date > r.endsOn)) return false
  if (!r.weekdays.includes(isoWeekday(date))) return false
  if (r.frequency === "weekly") {
    const weeks = daysBetween(mondayOf(r.startsOn), mondayOf(date)) / 7
    return weeks % r.interval === 0
  }
  return (
    r.monthWeek !== null &&
    isRequestedWeekOfMonth(date, r.monthWeek) &&
    monthsBetween(r.startsOn, date) % r.interval === 0
  )
}

/** Local dates between from and to (both inclusive) on which the meeting occurs. */
export function occurrencesBetween(r: Recurrence, from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) if (occursOn(r, d)) out.push(d)
  return out
}

/** The next occurrence on or after a date, looking ahead at most a year. */
export function nextOccurrence(r: Recurrence, onOrAfter: LocalDate): LocalDate | null {
  for (let d = onOrAfter, i = 0; i < 400; d = addDays(d, 1), i++) {
    if (r.endsOn !== null && d > r.endsOn) return null
    if (occursOn(r, d)) return d
  }
  return null
}
