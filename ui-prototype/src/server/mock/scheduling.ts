import { AUTOMATIC_CATEGORIES } from "@/lib/domain/calendar"
import { type OccasionHit, previewRows, type PreviewRow } from "@/lib/domain/planning"
import type { AnnualPlan, Instant, LocalDate, Schedule, Session, Uuid } from "@/lib/domain/types"

import type { State } from "./state"

export function automaticDays(s: State, serviceId: Uuid, year: number): LocalDate[] {
  return [
    ...new Set(
      s.occasions
        .filter(
          (o) =>
            o.date.startsWith(`${year}-`) &&
            o.verifiedAt !== null &&
            o.mode === "suggested" &&
            (o.serviceIds.length === 0 || o.serviceIds.includes(serviceId)) &&
            (o.category === "churchEvent" || AUTOMATIC_CATEGORIES.includes(o.category))
        )
        .map((o) => o.date)
    ),
  ].sort()
}

export function daysOffOf(s: State, serviceId: Uuid, year: number) {
  const entry = s.daysOff.find((d) => d.serviceId === serviceId && d.year === year)

  return entry?.mode === "custom"
    ? { mode: "custom" as const, days: [...entry.days].sort() }
    : { mode: "automatic" as const, days: automaticDays(s, serviceId, year) }
}

export function occasionHits(
  s: State,
  serviceId: Uuid,
  year: number
): Record<LocalDate, OccasionHit[]> {
  const hits: Record<LocalDate, OccasionHit[]> = {}
  const verified = s.occasions.filter((o) => o.date.startsWith(`${year}-`) && o.verifiedAt !== null)

  for (const o of verified) {
    if (o.mode === "mandatory" && (o.serviceIds.length === 0 || o.serviceIds.includes(serviceId))) {
      ;(hits[o.date] ??= []).push({
        id: o.id,
        key: o.key,
        name: o.name,
        category: o.category,
        mode: "mandatory",
      })
    }
  }

  for (const date of daysOffOf(s, serviceId, year).days) {
    if (hits[date]?.some((h) => h.mode === "mandatory")) {
      continue
    }

    const named = verified.filter((o) => o.date === date && o.mode === "suggested")
    hits[date] =
      named.length > 0
        ? named.map((o) => ({
            id: o.id,
            key: o.key,
            name: o.name,
            category: o.category,
            mode: "suggested" as const,
          }))
        : [{ id: null, key: null, name: null, category: null, mode: "suggested" }]
  }

  return hits
}

export function planPreview(s: State, schedule: Schedule, plan: AnnualPlan): PreviewRow[] {
  return previewRows(
    plan.rule,
    plan.year,
    occasionHits(s, schedule.serviceId, plan.year),
    plan.decisions
  )
}

export function recurringSessionOn(
  s: State,
  scheduleId: Uuid,
  date: LocalDate
): Session | undefined {
  return s.sessions.find(
    (x) =>
      x.scheduleId === scheduleId && x.kind === "recurring" && (x.originalDate ?? x.date) === date
  )
}

export function newSession(
  schedule: Schedule,
  fields: Pick<Session, "kind" | "date" | "startTime" | "endTime" | "location"> & Partial<Session>,
  id: Uuid,
  createdAt: Instant
): Session {
  return {
    id,
    scheduleId: schedule.id,
    serviceId: schedule.serviceId,
    stageId: schedule.stageId,
    planId: null,
    status: "scheduled",
    cancelReason: null,
    occasionId: null,
    originalDate: null,
    changedByHand: false,
    openedAt: null,
    closedAt: null,
    closedBy: null,
    createdAt,
    ...fields,
  }
}

export function materialize(
  s: State,
  schedule: Schedule,
  plan: AnnualPlan,
  newId: () => Uuid,
  createdAt: Instant,
  from: LocalDate | null = null
): number {
  let created = 0

  for (const row of planPreview(s, schedule, plan)) {
    if ((from !== null && row.date < from) || recurringSessionOn(s, schedule.id, row.date)) {
      continue
    }

    const canceled = row.decision === "cancel"

    s.sessions.push(
      newSession(
        schedule,
        {
          kind: "recurring",
          planId: plan.id,
          date: row.date,
          startTime: plan.rule.startTime,
          endTime: plan.rule.endTime,
          location: plan.rule.location,
          status: canceled ? "canceled" : "scheduled",
          occasionId: canceled ? (row.hits[0]?.id ?? null) : null,
        },
        newId(),
        createdAt
      )
    )
    created++
  }

  return created
}
