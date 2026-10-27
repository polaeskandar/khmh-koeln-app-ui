import { daysBetween } from "./time"
import type { LocalDate } from "./types"

/**
 * Data protection rules shared by the screens and the mock backend.
 *
 * The version of the privacy notice people accept when they register. When
 * the text changes in substance, the version changes and people are shown
 * the new notice.
 */
export const PRIVACY_VERSION = "2026-11"

/**
 * When the answer to a data protection request is due: one month after it
 * was received (DSGVO Art. 12(3)). A month ends on the same day of the next
 * month, or on its last day when that day doesn't exist (31 January → 28 or
 * 29 February).
 */
export function oneMonthAfter(date: LocalDate): LocalDate {
  const [y, m, d] = date.split("-").map(Number)
  const year = m === 12 ? y + 1 : y
  const month = m === 12 ? 1 : m + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Days left until the due date: 0 on the day, negative once it has passed. */
export function daysUntil(due: LocalDate, today: LocalDate): number {
  return daysBetween(today, due)
}
