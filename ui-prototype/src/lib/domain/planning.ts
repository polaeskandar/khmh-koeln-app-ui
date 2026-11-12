import { occurrencesBetween } from "./recurrence"
import { compareTime, isValidLocalDate, isValidLocalTime } from "./time"
import type {
  LocalDate,
  OccasionCategory,
  OccasionMode,
  PlanDecision,
  PlanRule,
  Recurrence,
  Uuid,
} from "./types"

export const PLANNING_REMINDER_FROM = { month: 10, day: 1 }

export function yearStart(year: number): LocalDate {
  return `${year}-01-01`
}

export function yearEnd(year: number): LocalDate {
  return `${year}-12-31`
}

export function planningWindow(rule: PlanRule, year: number): { from: LocalDate; to: LocalDate } {
  const from = rule.startsOn && rule.startsOn > yearStart(year) ? rule.startsOn : yearStart(year)
  const to = rule.endsOn && rule.endsOn < yearEnd(year) ? rule.endsOn : yearEnd(year)

  return { from, to }
}

export function recurrenceOf(rule: PlanRule, year: number): Recurrence {
  const { from, to } = planningWindow(rule, year)

  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: [rule.weekday],
    monthWeek: rule.frequency === "monthly" ? (rule.monthWeek ?? 1) : null,
    startsOn: from,
    endsOn: to,
  }
}

export function planDates(rule: PlanRule, year: number): LocalDate[] {
  const { from, to } = planningWindow(rule, year)

  if (from > to) {
    return []
  }

  return occurrencesBetween(recurrenceOf(rule, year), from, to)
}

export type RuleProblem =
  | "startTime"
  | "endTime"
  | "endBeforeStart"
  | "startsOn"
  | "endsOn"
  | "lastBeforeFirst"
  | "outsideYear"
  | "interval"

export function ruleProblems(
  rule: PlanRule,
  year: number
): Partial<Record<keyof PlanRule, RuleProblem>> {
  const problems: Partial<Record<keyof PlanRule, RuleProblem>> = {}

  if (!isValidLocalTime(rule.startTime)) {
    problems.startTime = "startTime"
  }

  if (rule.endTime !== null && !isValidLocalTime(rule.endTime)) {
    problems.endTime = "endTime"
  } else if (
    rule.endTime !== null &&
    isValidLocalTime(rule.startTime) &&
    compareTime(rule.endTime, rule.startTime) <= 0
  ) {
    problems.endTime = "endBeforeStart"
  }

  if (rule.startsOn !== null && !isValidLocalDate(rule.startsOn)) {
    problems.startsOn = "startsOn"
  }

  if (rule.endsOn !== null && !isValidLocalDate(rule.endsOn)) {
    problems.endsOn = "endsOn"
  }

  if (rule.startsOn && rule.endsOn && rule.endsOn < rule.startsOn) {
    problems.endsOn = "lastBeforeFirst"
  }

  if (rule.startsOn && rule.startsOn > yearEnd(year)) {
    problems.startsOn = "outsideYear"
  }

  if (rule.endsOn && rule.endsOn < yearStart(year)) {
    problems.endsOn = "outsideYear"
  }

  const allowed = rule.frequency === "weekly" ? [1, 2] : [1, 2, 3]

  if (!allowed.includes(rule.interval)) {
    problems.interval = "interval"
  }

  return problems
}

export type OccasionHit = {
  id: Uuid | null
  key: string | null
  name: string | null
  category: OccasionCategory | null
  mode: OccasionMode
}

export type PreviewRow = {
  date: LocalDate
  hits: OccasionHit[]
  decision: PlanDecision
  proposed: PlanDecision
  mandatory: boolean
}

export function previewRows(
  rule: PlanRule,
  year: number,
  hits: Record<LocalDate, OccasionHit[]>,
  decisions: Record<LocalDate, PlanDecision>
): PreviewRow[] {
  return planDates(rule, year).map((date) => {
    const dateHits = hits[date] ?? []
    const proposed: PlanDecision = dateHits.length > 0 ? "cancel" : "keep"

    return {
      date,
      hits: dateHits,
      proposed,
      decision: decisions[date] ?? proposed,
      mandatory: dateHits.some((h) => h.mode === "mandatory"),
    }
  })
}
