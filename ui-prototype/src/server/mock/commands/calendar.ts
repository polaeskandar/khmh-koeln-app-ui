import { msg } from "@/i18n/message"
import type {
  CalendarOccasion,
  DaysOffMode,
  LocalDate,
  OccasionMode,
  Uuid,
} from "@/lib/domain/types"
import { forbidden, ruleViolation } from "@/server/errors"

import { authorize, can, canInService } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { automaticDays } from "../scheduling"
import { serviceOf } from "../selectors"

import type { Actor } from "./accounts"

export function addChurchEvent(
  { state: s, viewer }: Actor,
  input: { date: string; name: string; mode: OccasionMode; serviceIds: Uuid[] }
) {
  authorize(s, viewer, "services.manage")
  const v = new Violations()
  const date = v.date("date", input.date)
  const name = v.name("name", input.name, 120, msg("errors.calendar.nameRequired"))

  if (date && date < today()) {
    v.add("date", msg("errors.sessions.inThePast"))
  }

  v.throwIfAny()
  input.serviceIds.forEach((id) => found(serviceOf(s, id), "service"))
  const occasion: CalendarOccasion = {
    id: uuidv7(nowMs()),
    date: date!,
    key: null,
    name,
    category: "churchEvent",
    source: "church",
    mode: input.mode,
    serviceIds: input.serviceIds,
    verifiedAt: now(),
    verifiedBy: viewer.id,
  }
  s.occasions.push(occasion)

  return occasion
}

export function removeChurchEvent({ state: s, viewer }: Actor, occasionId: Uuid) {
  authorize(s, viewer, "services.manage")
  const occasion = found(
    s.occasions.find((o) => o.id === occasionId),
    "occasion"
  )

  if (occasion.source !== "church") {
    throw ruleViolation(msg("errors.calendar.computed"))
  }

  s.occasions.splice(s.occasions.indexOf(occasion), 1)
}

export function verifyYear({ state: s, viewer }: Actor, year: number) {
  authorize(s, viewer, "services.manage")

  for (const o of s.occasions) {
    if (o.date.startsWith(`${year}-`) && o.verifiedAt === null) {
      o.verifiedAt = now()
      o.verifiedBy = viewer.id
    }
  }
}

function requireDaysOffManager({ state: s, viewer }: Actor, serviceId: Uuid) {
  found(serviceOf(s, serviceId), "service")

  if (
    !can(s, viewer, "services.manage") &&
    !canInService(s, viewer, "schedule.manage", serviceId)
  ) {
    throw forbidden()
  }
}

function checkYear(year: number) {
  const current = Number(today().slice(0, 4))

  if (year < current || year > current + 2) {
    throw ruleViolation(msg("errors.plans.year"))
  }
}

export function setDaysOffMode(actor: Actor, serviceId: Uuid, year: number, mode: DaysOffMode) {
  requireDaysOffManager(actor, serviceId)
  checkYear(year)
  const s = actor.state
  s.daysOff = s.daysOff.filter((d) => !(d.serviceId === serviceId && d.year === year))

  if (mode === "custom") {
    s.daysOff.push({ serviceId, year, mode, days: automaticDays(s, serviceId, year) })
  }
}

export function toggleDayOff(actor: Actor, serviceId: Uuid, date: LocalDate) {
  requireDaysOffManager(actor, serviceId)
  const v = new Violations()
  v.date("date", date)
  v.throwIfAny()
  const year = Number(date.slice(0, 4))
  checkYear(year)
  const s = actor.state
  let entry = s.daysOff.find((d) => d.serviceId === serviceId && d.year === year)

  if (!entry || entry.mode !== "custom") {
    s.daysOff = s.daysOff.filter((d) => !(d.serviceId === serviceId && d.year === year))
    entry = { serviceId, year, mode: "custom", days: automaticDays(s, serviceId, year) }
    s.daysOff.push(entry)
  }

  entry.days = entry.days.includes(date)
    ? entry.days.filter((d) => d !== date)
    : [...entry.days, date].sort()

  return entry.days.includes(date)
}
