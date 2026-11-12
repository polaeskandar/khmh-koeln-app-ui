import "server-only"

import { notFound } from "next/navigation"

import type { PlanRule, Unit, Uuid } from "@/lib/domain/types"
import { can, canSeeUnit } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import { planPreview, occasionHits } from "@/server/mock/scheduling"
import { planOf, scheduleFor, stageOf, unitsOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { accountRef, bySessionTime, sessionCard, unitRef } from "./present"
import { serviceFor } from "./services"

export function planningYearOptions() {
  const year = Number(today().slice(0, 4))

  return [year, year + 1, year + 2]
}

export function unitFor(ctx: Context, serviceId: Uuid, stageId: Uuid | null): Unit {
  const service = serviceFor(ctx, serviceId)
  const stage = stageOf(ctx.state, stageId)

  if (
    (stageId !== null && (!stage || stage.serviceId !== service.id)) ||
    (stageId === null && service.structure === "stages") ||
    (stageId !== null && service.structure === "single")
  ) {
    notFound()
  }

  const unit = { serviceId: service.id, stageId }

  if (!canSeeUnit(ctx.state, ctx.viewer, unit)) {
    notFound()
  }

  return unit
}

export function getUnitSchedule(ctx: Context, unit: Unit, year: number) {
  const { state: s, viewer } = ctx
  const schedule = scheduleFor(s, unit)!
  const plan = planOf(s, schedule.id, year)
  const sessions = s.sessions
    .filter((x) => x.scheduleId === schedule.id && x.date.startsWith(`${year}-`))
    .sort(bySessionTime)
    .map((x) => sessionCard(ctx, x))

  return {
    unit: unitRef(s, unit),
    scheduleId: schedule.id,
    year,
    years: planningYearOptions(),
    today: today(),
    plan: plan
      ? {
          status: plan.status,
          rule: plan.rule,
          version: plan.version,
          updatedBy: accountRef(s, plan.updatedBy),
          updatedAt: plan.updatedAt,
          confirmedBy: accountRef(s, plan.confirmedBy),
          confirmedAt: plan.confirmedAt,
          preview: plan.status === "draft" ? planPreview(s, schedule, plan) : [],
        }
      : null,
    sessions,
    canManage: can(s, viewer, "schedule.manage", unit),
    canRecord: can(s, viewer, "attendance.record", unit),
  }
}

const DEFAULT_RULE: PlanRule = {
  frequency: "weekly",
  interval: 1,
  weekday: 7,
  monthWeek: null,
  startTime: "",
  endTime: null,
  startsOn: null,
  endsOn: null,
  location: null,
}

export function getPlanEditor(ctx: Context, serviceId: Uuid, year: number, stageIds: Uuid[]) {
  const { state: s, viewer } = ctx
  const service = serviceFor(ctx, serviceId)

  if (!planningYearOptions().includes(year)) {
    notFound()
  }

  const units = unitsOf(s, service)
    .filter((u) => canSeeUnit(s, viewer, u) && can(s, viewer, "schedule.manage", u))
    .map((u) => {
      const schedule = scheduleFor(s, u)!
      const plan = planOf(s, schedule.id, year)

      return {
        unit: unitRef(s, u),
        scheduleId: schedule.id,
        status: plan?.status ?? ("none" as const),
        version: plan?.version ?? 0,
        selected:
          plan?.status !== "confirmed" &&
          (stageIds.length === 0 ? true : u.stageId !== null && stageIds.includes(u.stageId)),
      }
    })

  if (units.length === 0) {
    notFound()
  }

  const open = units.filter((u) => u.status !== "confirmed")
  const first = open.find((u) => u.selected) ?? open[0]
  const firstSchedule = first ? s.schedules.find((x) => x.id === first.scheduleId)! : null
  const draft = firstSchedule ? planOf(s, firstSchedule.id, year) : undefined
  const previous = firstSchedule ? planOf(s, firstSchedule.id, year - 1) : undefined
  const rule: PlanRule =
    draft?.rule ??
    (previous ? { ...previous.rule, startsOn: null, endsOn: null } : { ...DEFAULT_RULE })

  return {
    service: { id: service.id, name: service.name, structure: service.structure },
    year,
    units,
    rule,
    decisions: draft?.decisions ?? {},
    hits: occasionHits(s, service.id, year),
    unverified: s.occasions.some((o) => o.date.startsWith(`${year}-`) && o.verifiedAt === null),
    canKeepMandatory: can(s, viewer, "services.manage"),
  }
}
