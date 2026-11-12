import "server-only"

import { PLANNING_REMINDER_FROM } from "@/lib/domain/planning"
import { localTimeOf } from "@/lib/domain/time"
import { canSeeUnit, unitsWith } from "@/server/mock/access"
import { nowMs, today } from "@/server/mock/clock"
import { planOf, scheduleFor, serviceOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { bySessionTime, sessionCard, unitOf } from "./present"

export function planningYears(date: string): number[] {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const late =
    month > PLANNING_REMINDER_FROM.month ||
    (month === PLANNING_REMINDER_FROM.month && day >= PLANNING_REMINDER_FROM.day)

  return late ? [year, year + 1] : [year]
}

export function planningReminders({ state: s, viewer }: Context) {
  const units = unitsWith(s, viewer, "schedule.manage")

  return planningYears(today()).flatMap((year) => {
    const byService = new Map<
      string,
      { serviceId: string; name: string; missing: number; drafts: number }
    >()

    for (const unit of units) {
      const schedule = scheduleFor(s, unit)
      const plan = schedule ? planOf(s, schedule.id, year) : undefined

      if (!schedule || plan?.status === "confirmed") {
        continue
      }

      const service = serviceOf(s, unit.serviceId)!
      const entry = byService.get(service.id) ?? {
        serviceId: service.id,
        name: service.name,
        missing: 0,
        drafts: 0,
      }

      if (plan) {
        entry.drafts++
      } else {
        entry.missing++
      }

      byService.set(service.id, entry)
    }

    return byService.size > 0
      ? [{ year, services: [...byService.values()].sort((a, b) => a.name.localeCompare(b.name)) }]
      : []
  })
}

function partOfDay() {
  const hour = Number(localTimeOf(nowMs()).slice(0, 2))

  if (hour < 12) {
    return "morning" as const
  }

  return hour < 18 ? ("afternoon" as const) : ("evening" as const)
}

export function getHome(ctx: Context, postponed: number[]) {
  const { state: s, viewer } = ctx
  const date = today()
  const recordable = unitsWith(s, viewer, "attendance.record")
  const sessions = s.sessions
    .filter(
      (x) =>
        x.date === date &&
        recordable.some((u) => u.serviceId === x.serviceId && u.stageId === x.stageId) &&
        canSeeUnit(s, viewer, unitOf(x))
    )
    .sort(bySessionTime)
    .map((x) => sessionCard(ctx, x))

  return {
    partOfDay: partOfDay(),
    today: date,
    sessions,
    reminders: planningReminders(ctx).filter((r) => !postponed.includes(r.year)),
  }
}
