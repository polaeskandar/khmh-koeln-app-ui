import "server-only"

import { notFound } from "next/navigation"

import type { CalendarOccasion, LocalDate, Uuid } from "@/lib/domain/types"
import { can, canInService, visibleServices } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import { daysOffOf } from "@/server/mock/scheduling"
import type { State } from "@/server/mock/state"
import type { Context, Translator } from "@/server/viewer"

import { accountRef } from "./present"
import { planningYearOptions } from "./schedule"

export function occasionLabel(t: Translator, o: Pick<CalendarOccasion, "key" | "name">): string {
  return o.name ?? (o.key ? (t as unknown as (key: string) => string)(`occasions.${o.key}`) : "")
}

function verifiedOf(s: State, year: number) {
  return s.occasions.filter((o) => o.date.startsWith(`${year}-`) && o.verifiedAt !== null)
}

export function getCalendar(ctx: Context, year: number) {
  const { state: s, viewer } = ctx

  if (!planningYearOptions().includes(year)) {
    notFound()
  }

  const { t } = ctx
  const services = visibleServices(s, viewer).filter((x) => x.archivedAt === null)
  const occasions = s.occasions
    .filter((o) => o.date.startsWith(`${year}-`))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    year,
    years: planningYearOptions(),
    canManage: can(s, viewer, "services.manage"),
    today: today(),
    marks: Object.fromEntries(
      s.occasions
        .filter((o) => o.date.startsWith(`${year}-`) && o.mode === "mandatory")
        .map((o) => [o.date, { label: occasionLabel(t, o), kind: "locked" as const }])
    ),
    feasts: Object.fromEntries(
      s.occasions
        .filter((o) => o.date.startsWith(`${year}-`) && o.mode === "suggested")
        .map((o) => [o.date, occasionLabel(t, o)])
    ),
    unverified: occasions.filter((o) => o.verifiedAt === null).length,
    verifiedBy: accountRef(s, occasions.find((o) => o.verifiedBy)?.verifiedBy ?? null),
    occasions: occasions.map((o) => ({
      id: o.id,
      date: o.date,
      key: o.key,
      name: o.name,
      category: o.category,
      source: o.source,
      mode: o.mode,
      verified: o.verifiedAt !== null,
      services: o.serviceIds.map((id) => s.services.find((x) => x.id === id)?.name ?? ""),
    })),
    services: services
      .map((x) => ({
        id: x.id,
        name: x.name,
        tone: s.serviceTones[x.id] ?? 1,
        ...(() => {
          const daysOff = daysOffOf(s, x.id, year)

          return { mode: daysOff.mode, count: daysOff.days.length }
        })(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function getDaysOff(ctx: Context, serviceId: Uuid, year: number) {
  const { state: s, viewer, t } = ctx

  if (!planningYearOptions().includes(year)) {
    notFound()
  }

  const service = s.services.find((x) => x.id === serviceId)

  if (!service || !visibleServices(s, viewer).some((x) => x.id === service.id)) {
    notFound()
  }

  const verified = verifiedOf(s, year)
  const daysOff = daysOffOf(s, service.id, year)
  const marks: Record<LocalDate, { label: string; kind: "marked" | "locked" }> = {}
  const nameOn = (date: LocalDate) =>
    verified
      .filter((o) => o.date === date)
      .map((o) => occasionLabel(t, o))
      .join(", ")

  for (const date of daysOff.days) {
    marks[date] = { label: nameOn(date) || t("daysOff.markedByHand"), kind: "marked" }
  }

  for (const o of verified) {
    if (
      o.mode === "mandatory" &&
      (o.serviceIds.length === 0 || o.serviceIds.includes(service.id))
    ) {
      marks[o.date] = { label: occasionLabel(t, o), kind: "locked" }
    }
  }

  const feasts: Record<LocalDate, string> = {}

  for (const o of verified) {
    feasts[o.date] = feasts[o.date]
      ? `${feasts[o.date]}, ${occasionLabel(t, o)}`
      : occasionLabel(t, o)
  }

  return {
    service: { id: service.id, name: service.name, tone: s.serviceTones[service.id] ?? 1 },
    year,
    years: planningYearOptions(),
    today: today(),
    mode: daysOff.mode,
    marks,
    feasts,
    list: Object.entries(marks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, mark]) => ({ date, ...mark })),
    meetings: [
      ...new Set(
        s.sessions
          .filter(
            (x) =>
              x.serviceId === service.id && x.date.startsWith(`${year}-`) && x.status !== "canceled"
          )
          .map((x) => x.date)
      ),
    ],
    unverified: s.occasions.some((o) => o.date.startsWith(`${year}-`) && o.verifiedAt === null),
    canManage:
      can(s, viewer, "services.manage") || canInService(s, viewer, "schedule.manage", service.id),
  }
}
