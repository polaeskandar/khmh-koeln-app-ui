import "server-only"

import { can } from "@/lib/domain/policy"
import { occurrencesBetween } from "@/lib/domain/recurrence"
import { addDays, datesBetween, localDateOf } from "@/lib/domain/time"
import type { LocalDate, MeetingSession, Uuid } from "@/lib/domain/types"
import {
  compareAgenda,
  type AgendaItem,
  type HistoryEntry,
  type PlannedOccurrence,
  type SessionCard,
} from "@/lib/view-models"
import { today as clockToday } from "@/server/mock/clock"
import {
  isArchived,
  rosterOn,
  scheduleOf,
  serviceOf,
  sessionForOccurrence,
  sessionOf,
  stageOf,
  stagesOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import {
  isGenerating,
  plannedOccurrence,
  scheduleRosterSize,
  scheduleSummary,
  serviceRef,
  sessionCard,
  sortSessions,
  stageRef,
  userRef,
} from "./present"

type Scope = { serviceId?: Uuid; stageId?: Uuid }

const inScope = (scope: Scope) => (x: { serviceId: Uuid; stageId: Uuid | null }) =>
  (!scope.serviceId || x.serviceId === scope.serviceId) &&
  (!scope.stageId || x.stageId === scope.stageId)

/** Planned occurrences (no session yet) of generating schedules between two dates. */
function plannedBetween(
  ctx: Context,
  scope: Scope,
  from: LocalDate,
  to: LocalDate
): PlannedOccurrence[] {
  const { state: s, viewer } = ctx
  const out: PlannedOccurrence[] = []
  for (const sch of s.schedules.filter(inScope(scope))) {
    if (!isGenerating(s, sch)) continue
    for (const date of occurrencesBetween(sch.recurrence, from, to)) {
      if (sessionForOccurrence(s, sch.id, date)) continue
      const planned = plannedOccurrence(s, viewer, sch, date)
      if (planned) out.push(planned)
    }
  }
  return out
}

export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return [...items].sort(compareAgenda)
}

/** What is coming up: sessions that will still happen (or are happening) and planned dates. */
export function upcomingFor(
  ctx: Context,
  opts: Scope & { days: number; includeCanceled?: boolean }
): AgendaItem[] {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const to = addDays(today, opts.days)
  const sessions = s.sessions
    .filter(inScope(opts))
    .filter((x) => {
      const date = localDateOf(x.startsAt)
      if (date < today || date > to) return false
      return (
        x.status === "scheduled" ||
        x.status === "active" ||
        (opts.includeCanceled && x.status === "canceled")
      )
    })
    .map((x) => sessionCard(s, viewer, x))
  const planned = plannedBetween(ctx, opts, addDays(today, 1), to).filter((p) => p.date >= today)
  return sortAgenda([...sessions, ...planned])
}

export async function getAgenda(ctx: Context, params: { date?: string; service?: string }) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const from = addDays(today, -6)
  const to = addDays(today, 7)
  const scope: Scope = {
    serviceId: params.service && serviceOf(s, params.service) ? params.service : undefined,
  }
  const selected = params.date && params.date >= from && params.date <= to ? params.date : today
  const sessions = s.sessions
    .filter(inScope(scope))
    .filter((x) => {
      const date = localDateOf(x.startsAt)
      return date >= from && date <= to
    })
    .map((x) => sessionCard(s, viewer, x))
  const planned = plannedBetween(ctx, scope, addDays(today, 1), to)
  const items = sortAgenda([...sessions, ...planned])
  const days = datesBetween(from, to).map((date) => {
    const dayItems = items.filter((i) => i.date === date)
    return {
      date,
      items: dayItems,
      tones: dayItems
        .filter((i) => i.kind === "planned" || i.status !== "canceled")
        .map((i) => i.service.tone),
    }
  })
  const services = s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => serviceRef(s, x))
  return {
    today,
    selected,
    serviceId: scope.serviceId ?? null,
    days,
    services,
    canCreateOneOff: services.some((x) => can(viewer, "MANAGE_SESSIONS", x.id)),
  }
}

export function sessionHistory(s: State, session: MeetingSession): HistoryEntry[] {
  const created: HistoryEntry = {
    id: `${session.id}-created`,
    type: "created",
    at: session.createdAt,
    actor: null,
    note: null,
    detail: session.scheduleId ? { kind: "fromSchedule" } : { kind: "byHand" },
  }
  const events = s.events
    .filter((e) => e.sessionId === session.id)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map<HistoryEntry>((e) => ({
      id: e.id,
      type: e.type,
      at: e.occurredAt,
      actor: userRef(userOf(s, e.actorId)),
      // A move keeps the previous start in its note; everything else is a reason someone wrote.
      note: e.type === "moved" ? null : e.note,
      detail: e.type === "moved" && e.note ? { kind: "movedFrom", at: e.note } : null,
    }))
  return [created, ...events]
}

export async function getSessionDetail(ctx: Context, id: Uuid) {
  const { state: s, viewer } = ctx
  const session = sessionOf(s, id)
  if (!session) return null
  const schedule = scheduleOf(s, session.scheduleId)
  // The lesson prepared for this meeting: linked by (schedule, date), or directly for one-off sessions.
  const lesson = s.lessons.find(
    (l) =>
      !l.archivedAt &&
      (l.sessionId === session.id ||
        (session.scheduleId !== null &&
          l.scheduleId === session.scheduleId &&
          l.teachingDate === session.occurrenceDate))
  )
  return {
    session: sessionCard(s, viewer, session),
    schedule: schedule ? scheduleSummary(s, viewer, schedule) : null,
    history: sessionHistory(s, session),
    lesson:
      lesson && lesson.stageId
        ? {
            id: lesson.id,
            title: lesson.title,
            status: lesson.status,
            href: `/services/${lesson.serviceId}/stages/${lesson.stageId}/lessons/${lesson.id}`,
            canSee: can(viewer, "VIEW_SERVICE", lesson.serviceId),
          }
        : null,
    stageHref: session.stageId
      ? `/services/${session.serviceId}/stages/${session.stageId}`
      : `/services/${session.serviceId}`,
    today: clockToday(),
  }
}

export async function listSchedules(ctx: Context, params: { service?: string; status?: string }) {
  const { state: s, viewer } = ctx
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active"
  const serviceId = params.service && serviceOf(s, params.service) ? params.service : null
  const all = s.schedules.map((x) => scheduleSummary(s, viewer, x))
  const position = (x: (typeof all)[number]) => stageOf(s, x.stage?.id)?.position ?? -1
  const filtered = all.filter(
    (x) =>
      (!serviceId || x.service.id === serviceId) &&
      (status === "all" || (status === "active" ? x.active : !x.active))
  )
  const groups = s.services
    .filter((svc) => filtered.some((x) => x.service.id === svc.id))
    .sort(
      (a, b) => Number(isArchived(a)) - Number(isArchived(b)) || a.name.localeCompare(b.name, "de")
    )
    .map((svc) => ({
      service: serviceRef(s, svc),
      schedules: filtered
        .filter((x) => x.service.id === svc.id)
        // Like the stages: service-wide schedules first, then in the stages' display order.
        .sort(
          (a, b) =>
            position(a) - position(b) ||
            a.group.localeCompare(b.group, "de") ||
            a.startTime.localeCompare(b.startTime)
        ),
    }))
  const services = s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => ({
      ...serviceRef(s, x),
      stages: stagesOf(s, x.id).map((st) => stageRef(st)!),
      canManage: can(viewer, "MANAGE_SESSIONS", x.id),
    }))
  return {
    groups,
    status,
    serviceId,
    counts: {
      active: all.filter((x) => x.active && (!serviceId || x.service.id === serviceId)).length,
      inactive: all.filter((x) => !x.active && (!serviceId || x.service.id === serviceId)).length,
    },
    services,
    canCreate: services.some((x) => x.canManage),
  }
}

export async function getScheduleDetail(ctx: Context, id: Uuid) {
  const { state: s, viewer } = ctx
  const sch = scheduleOf(s, id)
  if (!sch) return null
  const today = clockToday()
  const summary = scheduleSummary(s, viewer, sch)
  // The next eight dates: sessions that already exist (also canceled or moved ones) and planned dates.
  const dates = occurrencesBetween(sch.recurrence, today, addDays(today, 120)).slice(0, 8)
  const next: AgendaItem[] = dates.flatMap((date): AgendaItem[] => {
    const session = sessionForOccurrence(s, sch.id, date)
    if (session) return session.status === "completed" ? [] : [sessionCard(s, viewer, session)]
    if (!isGenerating(s, sch)) return []
    const planned = plannedOccurrence(s, viewer, sch, date)
    return planned ? [planned] : []
  })
  const past = sortSessions(
    s.sessions
      .filter(
        (x) =>
          x.scheduleId === sch.id && (x.status === "completed" || localDateOf(x.startsAt) < today)
      )
      .map((x) => sessionCard(s, viewer, x))
  )
    .reverse()
    .slice(0, 12)
  const service = serviceOf(s, sch.serviceId)!
  const stage = stageOf(s, sch.stageId)
  return {
    schedule: summary,
    serviceArchived: isArchived(service),
    stageArchived: stage ? isArchived(stage) : false,
    generating: isGenerating(s, sch),
    next,
    past,
    stages: stagesOf(s, sch.serviceId).map((x) => stageRef(x)!),
    rosterSize: scheduleRosterSize(s, sch),
    updatedAt: sch.updatedAt,
    createdAt: sch.createdAt,
  }
}

/** Today's sessions the viewer can take attendance for: the attendance page's "Today". */
export function todaysSessions(ctx: Context): SessionCard[] {
  const { state: s, viewer } = ctx
  const today = clockToday()
  return sortSessions(
    s.sessions
      .filter(
        (x) =>
          localDateOf(x.startsAt) === today &&
          can(viewer, "RECORD_ATTENDANCE", x.serviceId, x.stageId)
      )
      .map((x) => sessionCard(s, viewer, x))
  )
}

export type FormService = {
  id: Uuid
  name: string
  tone: number
  canManage: boolean
  /** People without a stage: the roster of a service-wide meeting. */
  serviceLevelMembers: number
  stages: { id: Uuid; name: string; members: number }[]
}

/** Services, stages and roster sizes for the schedule and one-off session forms. */
export function formServices(ctx: Context): FormService[] {
  const { state: s, viewer } = ctx
  const today = clockToday()
  return s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => ({
      id: x.id,
      name: x.name,
      tone: serviceRef(s, x).tone,
      canManage: can(viewer, "MANAGE_SESSIONS", x.id),
      serviceLevelMembers: rosterOn(s, x.id, null, today).length,
      stages: stagesOf(s, x.id).map((st) => ({
        id: st.id,
        name: st.name,
        members: rosterOn(s, x.id, st.id, today).length,
      })),
    }))
}
