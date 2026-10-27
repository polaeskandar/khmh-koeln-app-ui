import type { Instant, IsoWeekday, LocalDate, LocalTime } from "./types"

/**
 * Calendar and time-zone helpers. Everything the church does happens on local
 * dates in Europe/Berlin, and the backend should follow the same rules:
 * calendar arithmetic runs on plain dates (no DST surprises) and a local
 * wall-clock time becomes an instant only at the very end.
 */
export const CHURCH_TIME_ZONE = "Europe/Berlin"

const DAY_MS = 86_400_000

function parseDate(date: LocalDate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number)
  return [y, m, d]
}

function utcMidnight(date: LocalDate): number {
  const [y, m, d] = parseDate(date)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMidnight(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMidnight(utcMidnight(date) + days * DAY_MS)
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS)
}

/** ISO-8601 weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: LocalDate): IsoWeekday {
  const day = new Date(utcMidnight(date)).getUTCDay()
  return (day === 0 ? 7 : day) as IsoWeekday
}

export function daysInMonth(date: LocalDate): number {
  const [y, m] = parseDate(date)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Monday of the ISO week the date belongs to. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date))
}

export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    partsFormatters.set(timeZone, f)
  }
  return f
}

type WallClock = { date: LocalDate; time: LocalTime; seconds: number }

function wallClock(epochMs: number, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00"
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    seconds: Number(get("second")),
  }
}

/** UTC offset of the zone at an instant, in minutes (e.g. 60 for CET, 120 for CEST). */
export function offsetMinutes(epochMs: number, timeZone: string = CHURCH_TIME_ZONE): number {
  const wall = wallClock(epochMs, timeZone)
  const [y, m, d] = parseDate(wall.date)
  const [hh, mm] = wall.time.split(":").map(Number)
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, wall.seconds)
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / 60_000)
}

/**
 * The instant at which a local wall-clock time happens. Matches PHP's
 * DateTimeImmutable: a time inside the spring-forward gap moves forward by the
 * gap ("02:30" becomes 03:30 CEST); an ambiguous autumn time takes the later,
 * standard-time occurrence.
 */
export function zonedInstant(
  date: LocalDate,
  time: LocalTime,
  timeZone: string = CHURCH_TIME_ZONE
): number {
  const [y, m, d] = parseDate(date)
  const [hh, mm] = time.split(":").map(Number)
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm)
  const before = offsetMinutes(wallAsUtc - DAY_MS, timeZone)
  const after = offsetMinutes(wallAsUtc + DAY_MS, timeZone)
  const candidates = [...new Set([before, after])]
    .map((offset) => wallAsUtc - offset * 60_000)
    .filter((epoch) => {
      const wall = wallClock(epoch, timeZone)
      return wall.date === date && wall.time === time
    })
  if (candidates.length > 0) return Math.max(...candidates)
  // Spring-forward gap: interpret with the offset that applied before the jump.
  return wallAsUtc - before * 60_000
}

/** RFC 3339 with the zone's offset, e.g. 2026-11-08T12:00:00+01:00. */
export function toInstant(epochMs: number, timeZone: string = CHURCH_TIME_ZONE): Instant {
  const wall = wallClock(epochMs, timeZone)
  const offset = offsetMinutes(epochMs, timeZone)
  const sign = offset >= 0 ? "+" : "-"
  const abs = Math.abs(offset)
  const hh = String(Math.floor(abs / 60)).padStart(2, "0")
  const mm = String(abs % 60).padStart(2, "0")
  return `${wall.date}T${wall.time}:${String(wall.seconds).padStart(2, "0")}${sign}${hh}:${mm}`
}

export function localInstant(
  date: LocalDate,
  time: LocalTime,
  timeZone: string = CHURCH_TIME_ZONE
): Instant {
  return toInstant(zonedInstant(date, time, timeZone), timeZone)
}

export function epochOf(instant: Instant): number {
  return Date.parse(instant)
}

export function localDateOf(
  instant: Instant | number,
  timeZone: string = CHURCH_TIME_ZONE
): LocalDate {
  return wallClock(typeof instant === "number" ? instant : Date.parse(instant), timeZone).date
}

export function localTimeOf(
  instant: Instant | number,
  timeZone: string = CHURCH_TIME_ZONE
): LocalTime {
  return wallClock(typeof instant === "number" ? instant : Date.parse(instant), timeZone).time
}

export function isValidLocalDate(value: string): value is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = parseDate(value)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

export function isValidLocalTime(value: string): value is LocalTime {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function compareTime(a: LocalTime, b: LocalTime): number {
  return a.localeCompare(b)
}
