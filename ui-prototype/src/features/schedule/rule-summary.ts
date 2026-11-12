import type { PlanRule } from "@/lib/domain/types"
import type { Format } from "@/lib/format"

export function ruleSummary(f: Format, rule: PlanRule): string {
  const pattern = f.recurrence({
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays: [rule.weekday],
    monthWeek: rule.frequency === "monthly" ? (rule.monthWeek ?? 1) : null,
    startsOn: rule.startsOn ?? "2000-01-01",
    endsOn: rule.endsOn,
  })

  return [pattern, rule.startTime ? f.timeRange(rule.startTime, rule.endTime) : null, rule.location]
    .filter(Boolean)
    .join(" · ")
}
