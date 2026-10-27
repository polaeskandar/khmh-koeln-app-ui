import "server-only"

import { isAdministrator } from "@/lib/domain/policy"
import { addDays, localDateOf, localTimeOf } from "@/lib/domain/time"
import type { LocalDate, LocalTime, SessionStatus, Uuid } from "@/lib/domain/types"
import { compareAgenda, type AgendaItem, type ServiceRef } from "@/lib/view-models"
import { nowMs, today as clockToday } from "@/server/mock/clock"
import { isArchived, personOf, serviceOf, stagesOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { upcomingFor } from "./meetings"
import { serviceRef, sessionCard, sortSessions } from "./present"
import { attendanceTrend, memberCount } from "./services"

export type UpcomingEntry = {
  key: string
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  service: ServiceRef
  label: string
  title: string
  count: number
  status: SessionStatus | "planned"
  moved: boolean
  cancelReason: string | null
  createdOn: LocalDate | null
  href: string
}

/**
 * Collapses parallel meetings of one service (e.g. six Sunday School classes
 * at 12:00) into one line, so "Coming up" stays short. Canceled or moved
 * sessions keep their own line.
 */
function groupUpcoming(items: AgendaItem[], ctx: Context): UpcomingEntry[] {
  const out: (UpcomingEntry & { names: string[] })[] = []
  for (const item of items) {
    const status = item.kind === "planned" ? "planned" : item.status
    const moved = item.kind === "session" && item.moved
    const last = out.at(-1)
    if (
      last &&
      !moved &&
      !last.moved &&
      (status === "planned" || status === "scheduled") &&
      last.status === status &&
      last.date === item.date &&
      last.startTime === item.startTime &&
      last.service.id === item.service.id &&
      last.title === item.title
    ) {
      last.count += 1
      last.names.push(item.group)
      last.label =
        last.count <= 2
          ? ctx.f.list(last.names)
          : ctx.t("dashboard.stagesCount", { count: last.count })
      last.href = `/meetings?date=${item.date}&service=${item.service.id}`
      continue
    }
    out.push({
      key: item.kind === "planned" ? item.key : item.id,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      service: item.service,
      label: item.group,
      names: [item.group],
      title: item.title,
      count: 1,
      status,
      moved,
      cancelReason: item.kind === "session" ? item.cancelReason : null,
      createdOn: item.kind === "planned" ? item.createdOn : null,
      href:
        item.kind === "planned"
          ? `/meetings/schedules/${item.scheduleId}`
          : `/meetings/sessions/${item.id}`,
    })
  }
  return out.map((entry) => {
    const { names, ...rest } = entry
    void names
    return rest
  })
}

function greeting(hour: number) {
  if (hour < 12) return "morning" as const
  if (hour < 18) return "afternoon" as const
  return "evening" as const
}

export async function getDashboard(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const tomorrow = addDays(today, 1)
  const myServiceIds: Uuid[] = (
    isAdministrator(viewer)
      ? s.services.map((x) => x.id)
      : [...new Set(viewer.roles.map((r) => r.serviceId).filter((id): id is Uuid => !!id))]
  ).filter((id) => {
    const service = serviceOf(s, id)
    return service && !isArchived(service)
  })
  const mine = (x: { serviceId: Uuid }) => myServiceIds.includes(x.serviceId)

  // Every meeting of the day in the viewer's services, also the ones another
  // servant takes attendance for. Each card offers only what the viewer may
  // do, and the viewer's own meetings come first (a servant's class on top).
  const todayCards = sortSessions(
    s.sessions
      .filter((x) => mine(x) && localDateOf(x.startsAt) === today)
      .map((x) => sessionCard(s, viewer, x))
  ).sort((a, b) => Number(b.can.record) - Number(a.can.record))
  const tomorrowCards = sortSessions(
    s.sessions
      .filter((x) => mine(x) && localDateOf(x.startsAt) === tomorrow)
      .map((x) => sessionCard(s, viewer, x))
  )
  const comingUp = groupUpcoming(
    myServiceIds
      .flatMap((serviceId) => upcomingFor(ctx, { serviceId, days: 7, includeCanceled: true }))
      .filter((x) => x.date >= tomorrow)
      .sort(compareAgenda),
    ctx
  )
  // Earlier sessions that still need someone: attendance never taken, or never closed.
  const attention = sortSessions(
    s.sessions
      .filter(
        (x) =>
          mine(x) &&
          localDateOf(x.startsAt) < today &&
          localDateOf(x.startsAt) >= addDays(today, -21) &&
          (x.status === "scheduled" || x.status === "active")
      )
      .map((x) => sessionCard(s, viewer, x))
  )
  const recent = s.sessions
    .filter((x) => mine(x) && x.status === "completed" && x.closedAt)
    .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))
    .slice(0, 5)
    .map((x) => sessionCard(s, viewer, x))
  const services = myServiceIds
    .map((id) => serviceOf(s, id)!)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((service) => {
      const next = upcomingFor(ctx, { serviceId: service.id, days: 14 })[0] ?? null
      return {
        ...serviceRef(s, service),
        stages: stagesOf(s, service.id).length,
        members: memberCount(s, service.id),
        trend: attendanceTrend(s, { serviceId: service.id }),
        next: next ? { date: next.date, startTime: next.startTime, group: next.group } : null,
      }
    })
  const person = personOf(s, viewer.personId)
  const ms = nowMs()
  return {
    greeting: ctx.t(`dashboard.greeting.${greeting(Number(localTimeOf(ms).slice(0, 2)))}`, {
      name: person?.firstName ?? viewer.displayName.split(" ")[0],
    }),
    today,
    time: localTimeOf(ms),
    todaySessions: todayCards,
    tomorrowSessions: tomorrowCards,
    comingUp,
    attention,
    recent,
    services,
  }
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>
