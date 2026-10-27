import "server-only"

import { fullName, initials, preferredName } from "@/lib/domain/names"
import { can, isAdministrator, isStaff } from "@/lib/domain/policy"
import { nextOccurrence } from "@/lib/domain/recurrence"
import { addDays, localDateOf, localTimeOf } from "@/lib/domain/time"
import type {
  LocalDate,
  MeetingSchedule,
  MeetingSession,
  Person,
  Service,
  Stage,
  User,
  Uuid,
} from "@/lib/domain/types"
import {
  compareAgenda,
  type PersonRef,
  type PlannedOccurrence,
  type ScheduleSummary,
  type ServiceRef,
  type SessionCard,
  type StageRef,
  type UserRef,
  type ViewerInfo,
} from "@/lib/view-models"
import { today } from "@/server/mock/clock"
import { occurrenceOn } from "@/server/mock/generator"
import {
  childrenOf,
  isArchived,
  rosterOn,
  serviceOf,
  sessionCounts,
  sessionForOccurrence,
  stageOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

/** Identity colour slot (1–8), fixed when the service was created. */
export function serviceTone(s: State, id: Uuid): number {
  return s.serviceTones[id] ?? 1
}

export function serviceRef(s: State, service: Service): ServiceRef {
  return {
    id: service.id,
    name: service.name,
    tone: serviceTone(s, service.id),
    archived: isArchived(service),
  }
}

export function stageRef(stage: Stage | undefined | null): StageRef | null {
  return stage ? { id: stage.id, name: stage.name, archived: isArchived(stage) } : null
}

export function userRef(user: User | undefined | null): UserRef | null {
  if (!user) return null
  const [first = "", last = ""] = user.displayName.split(" ")
  return {
    id: user.id,
    name: user.displayName,
    initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase(),
  }
}

export function personRef(p: Person): PersonRef {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: p.displayName,
    name: preferredName(p),
    fullName: fullName(p),
    initials: initials(p),
    status: p.status,
  }
}

export function sessionCard(s: State, viewer: User, x: MeetingSession): SessionCard {
  const service = serviceOf(s, x.serviceId)!
  const stage = stageOf(s, x.stageId)
  const counts = sessionCounts(s, x)
  const date = localDateOf(x.startsAt)
  return {
    kind: "session",
    id: x.id,
    title: x.title,
    group: stage?.name ?? service.name,
    order: stage?.position ?? -1,
    service: serviceRef(s, service),
    stage: stageRef(stage),
    scheduleId: x.scheduleId,
    date,
    occurrenceDate: x.occurrenceDate,
    startTime: localTimeOf(x.startsAt),
    endTime: x.endsAt ? localTimeOf(x.endsAt) : null,
    startsAt: x.startsAt,
    location: x.location,
    status: x.status,
    rosterMode: x.rosterMode,
    moved: s.events.some((e) => e.sessionId === x.id && e.type === "moved"),
    oneOff: x.scheduleId === null,
    cancelReason: x.cancelReason,
    counts,
    openedAt: x.openedAt,
    closedAt: x.closedAt,
    closedBy: userRef(userOf(s, x.closedBy)),
    can: {
      record: can(viewer, "RECORD_ATTENDANCE", x.serviceId, x.stageId),
      manage: can(viewer, "MANAGE_SESSIONS", x.serviceId),
      reopen: can(viewer, "REOPEN_SESSION", x.serviceId),
    },
  }
}

export function scheduleRosterSize(
  s: State,
  sch: MeetingSchedule,
  date: LocalDate = today()
): number | null {
  return sch.rosterMode === "open" ? null : rosterOn(s, sch.serviceId, sch.stageId, date).length
}

export function plannedOccurrence(
  s: State,
  viewer: User,
  sch: MeetingSchedule,
  date: LocalDate
): PlannedOccurrence | null {
  const occ = occurrenceOn(sch, date)
  if (!occ) return null
  const service = serviceOf(s, sch.serviceId)!
  const stage = stageOf(s, sch.stageId)
  return {
    kind: "planned",
    key: `${sch.id}@${date}`,
    scheduleId: sch.id,
    title: sch.name,
    group: stage?.name ?? service.name,
    order: stage?.position ?? -1,
    service: serviceRef(s, service),
    stage: stageRef(stage),
    date,
    startTime: sch.startTime,
    endTime: sch.endTime,
    location: sch.location,
    rosterMode: sch.rosterMode,
    rosterSize: scheduleRosterSize(s, sch, date),
    createdOn: addDays(date, -1),
    can: { manage: can(viewer, "MANAGE_SESSIONS", sch.serviceId) },
  }
}

/** Is the schedule currently producing sessions? */
export function isGenerating(s: State, sch: MeetingSchedule): boolean {
  const service = serviceOf(s, sch.serviceId)
  const stage = stageOf(s, sch.stageId)
  return sch.active && !!service && !isArchived(service) && (!stage || !isArchived(stage))
}

export function scheduleSummary(s: State, viewer: User, sch: MeetingSchedule): ScheduleSummary {
  const service = serviceOf(s, sch.serviceId)!
  const stage = stageOf(s, sch.stageId)
  let next: ScheduleSummary["next"] = null
  if (isGenerating(s, sch)) {
    // The next meeting is either a session that already exists (today's or
    // tomorrow's, or one changed in advance) or the first planned date.
    const from = today()
    const session = s.sessions
      .filter(
        (x) =>
          x.scheduleId === sch.id &&
          (x.status === "scheduled" || x.status === "active") &&
          localDateOf(x.startsAt) >= from
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    let date = nextOccurrence(sch.recurrence, from)
    while (date && sessionForOccurrence(s, sch.id, date))
      date = nextOccurrence(sch.recurrence, addDays(date, 1))
    const planned = date ? plannedOccurrence(s, viewer, sch, date) : null
    if (session && (!planned || session.startsAt <= `${planned.date}T${planned.startTime}`)) {
      next = {
        date: localDateOf(session.startsAt),
        startTime: localTimeOf(session.startsAt),
        status: session.status,
        moved: s.events.some((e) => e.sessionId === session.id && e.type === "moved"),
      }
    } else if (planned) {
      next = { date: planned.date, startTime: planned.startTime, status: "planned", moved: false }
    }
  }
  return {
    id: sch.id,
    name: sch.name,
    description: sch.description,
    service: serviceRef(s, service),
    stage: stageRef(stage),
    group: stage?.name ?? service.name,
    recurrence: sch.recurrence,
    startTime: sch.startTime,
    endTime: sch.endTime,
    location: sch.location,
    rosterMode: sch.rosterMode,
    rosterSize: scheduleRosterSize(s, sch),
    active: sch.active,
    next,
    sessionCount: s.sessions.filter((x) => x.scheduleId === sch.id).length,
    can: { manage: can(viewer, "MANAGE_SESSIONS", sch.serviceId) },
  }
}

/** How an account appears in menus, with a one-line summary of its roles in the request's language. */
export function viewerInfo(ctx: Context, viewer: User): ViewerInfo {
  const { state: s, t, f } = ctx
  const roles = viewer.roles.map((r) => ({
    role: r.role,
    service: r.serviceId ? serviceRef(s, serviceOf(s, r.serviceId)!) : null,
    stage: stageRef(stageOf(s, r.stageId)),
  }))
  const admin = isAdministrator(viewer)
  const children = childrenOf(s, viewer.id)
  const staffRoles = roles.filter((r) => r.role === "service_leader" || r.role === "servant")
  const first = staffRoles[0]
  const roleSummary = admin
    ? t("roles.administrator")
    : first
      ? t("roles.summary.staff", {
          role: t(`roles.${first.role}`),
          where: first.stage?.name ?? first.service?.name ?? "",
          more: staffRoles.length - 1,
        })
      : children.length > 0
        ? t("roles.summary.parentOf", {
            children: f.list(children.map((c) => c.displayName ?? c.firstName)),
          })
        : roles.some((r) => r.role === "parent")
          ? t("roles.summary.parentWaiting")
          : t("roles.summary.none")
  return {
    ...userRef(viewer)!,
    email: viewer.email,
    roleSummary,
    roles,
    isAdmin: admin,
    isStaff: isStaff(viewer),
    // Has a parent account, even while access to a child is still waiting for approval.
    isParent: roles.some((r) => r.role === "parent"),
  }
}

export function sortSessions<T extends SessionCard>(items: T[]): T[] {
  return [...items].sort(compareAgenda)
}
