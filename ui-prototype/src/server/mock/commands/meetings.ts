import "server-only"

import {
  normalizeWeekdays,
  occursOn,
  RecurrenceError,
  validateRecurrence,
} from "@/lib/domain/recurrence"
import { epochOf, localDateOf, localInstant, toInstant } from "@/lib/domain/time"
import type {
  IsoWeekday,
  LocalDate,
  LocalTime,
  MeetingSchedule,
  MeetingSession,
  MonthWeek,
  Recurrence,
  RosterMode,
  SessionEventType,
  User,
  Uuid,
} from "@/lib/domain/types"
import { type Message, msg } from "@/i18n/message"
import { ruleViolation } from "@/server/errors"

import { nowMs, today } from "../clock"
import { generate, occurrenceOn, sessionFromOccurrence } from "../generator"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import {
  isArchived,
  scheduleOf,
  serviceOf,
  sessionForOccurrence,
  sessionOf,
  stageOf,
} from "../selectors"
import type { State } from "../state"

// --------------------------------------------------------------- schedules

export type ScheduleInput = {
  serviceId: Uuid
  stageId: Uuid | null
  name: string
  description?: string | null
  location?: string | null
  frequency: "weekly" | "monthly"
  interval: number
  weekdays: number[]
  monthWeek: number | null
  startsOn: string
  endsOn: string | null
  startTime: string
  endTime: string | null
  rosterMode: RosterMode
}

function validateSchedule(s: State, input: ScheduleInput, existing?: MeetingSchedule) {
  const v = new Violations()
  const service = serviceOf(s, existing?.serviceId ?? input.serviceId)
  if (!service) v.add("serviceId", msg("errors.meetings.chooseService"))
  else if (isArchived(service)) {
    v.add("serviceId", msg("errors.meetings.serviceArchived", { name: service.name }))
  }
  let stageId: Uuid | null = null
  if (input.stageId) {
    const stage = stageOf(s, input.stageId)
    if (!stage || stage.serviceId !== service?.id)
      v.add("stageId", msg("errors.meetings.chooseStage"))
    else if (isArchived(stage)) {
      v.add("stageId", msg("errors.meetings.stageArchived", { name: stage.name }))
    } else stageId = stage.id
  }
  const name = v.name("name", input.name, 120, msg("errors.meetings.scheduleNameRequired"))
  const description = v.optionalText("description", input.description, 500)
  const location = v.optionalText("location", input.location, 120)
  const startsOn = v.date("startsOn", input.startsOn)
  const endsOn = v.date("endsOn", input.endsOn, false)
  const startTime = v.time("startTime", input.startTime)
  const endTime = v.time("endTime", input.endTime, false)
  if (startTime && endTime && !v.has("startTime") && !v.has("endTime") && endTime <= startTime) {
    v.add("endTime", msg("errors.meetings.endAfterStart"))
  }
  if (input.rosterMode !== "expected" && input.rosterMode !== "open")
    v.add("rosterMode", msg("errors.meetings.chooseRosterMode"))
  const recurrence: Recurrence = {
    frequency: input.frequency,
    interval: Number(input.interval),
    weekdays: normalizeWeekdays(input.weekdays) as IsoWeekday[],
    monthWeek: input.frequency === "monthly" ? ((input.monthWeek ?? 1) as MonthWeek) : null,
    startsOn: startsOn ?? "",
    endsOn: endsOn,
  }
  if (!v.has("startsOn") && !v.has("endsOn")) {
    try {
      validateRecurrence(recurrence)
    } catch (e) {
      if (!(e instanceof RecurrenceError)) throw e
      const field =
        e.code === "endBeforeStart" ? "endsOn" : e.code === "interval" ? "interval" : "weekdays"
      v.add(field, msg(`errors.recurrence.${e.code}`))
    }
  }
  v.throwIfAny()
  return {
    serviceId: service!.id,
    stageId,
    name,
    description,
    location,
    recurrence,
    startTime: startTime as LocalTime,
    endTime: endTime as LocalTime | null,
    rosterMode: input.rosterMode,
  }
}

/** Runs the generator right away so a schedule that starts today or tomorrow gets its sessions without waiting for the next hourly run. */
function generateNow(s: State) {
  const ms = nowMs()
  const run = generate(s, localDateOf(ms), ms)
  if (run.created > 0) s.generatorRuns.push(run)
  return run
}

export function createSchedule(
  s: State,
  actor: User,
  input: ScheduleInput
): { schedule: MeetingSchedule; created: number } {
  authorize(actor, "MANAGE_SESSIONS", input.serviceId)
  const data = validateSchedule(s, input)
  const ms = nowMs()
  const schedule: MeetingSchedule = {
    id: uuidv7(ms),
    ...data,
    active: true,
    createdAt: toInstant(ms),
    updatedAt: toInstant(ms),
  }
  s.schedules.push(schedule)
  return { schedule, created: generateNow(s).created }
}

/**
 * Edits the schedule. Sessions that were already created (today's and
 * tomorrow's at most) keep their details; every session created from now on
 * uses the new ones. Past sessions never change.
 */
export function updateSchedule(
  s: State,
  actor: User,
  id: Uuid,
  input: Omit<ScheduleInput, "serviceId">
): { schedule: MeetingSchedule; created: number } {
  const schedule = found(scheduleOf(s, id), "schedule")
  authorize(actor, "MANAGE_SESSIONS", schedule.serviceId)
  const data = validateSchedule(s, { ...input, serviceId: schedule.serviceId }, schedule)
  Object.assign(schedule, data, { updatedAt: toInstant(nowMs()) })
  return { schedule, created: schedule.active ? generateNow(s).created : 0 }
}

export function setScheduleActive(s: State, actor: User, id: Uuid, active: boolean) {
  const schedule = found(scheduleOf(s, id), "schedule")
  authorize(actor, "MANAGE_SESSIONS", schedule.serviceId)
  if (schedule.active === active) return { schedule, created: 0 }
  if (active) {
    const service = serviceOf(s, schedule.serviceId)!
    if (isArchived(service)) {
      throw ruleViolation(
        msg("errors.meetings.serviceArchivedRestoreFirst", { name: service.name })
      )
    }
    const stage = stageOf(s, schedule.stageId)
    if (stage && isArchived(stage)) {
      throw ruleViolation(msg("errors.meetings.stageArchivedRestoreFirst", { name: stage.name }))
    }
  }
  schedule.active = active
  schedule.updatedAt = toInstant(nowMs())
  return { schedule, created: active ? generateNow(s).created : 0 }
}

export function deleteSchedule(s: State, actor: User, id: Uuid): MeetingSchedule {
  const schedule = found(scheduleOf(s, id), "schedule")
  authorize(actor, "MANAGE_SESSIONS", schedule.serviceId)
  const sessions = s.sessions.filter((x) => x.scheduleId === id).length
  if (sessions > 0) {
    throw ruleViolation(msg("errors.meetings.scheduleHasSessions", { count: sessions }))
  }
  s.schedules = s.schedules.filter((x) => x.id !== id)
  return schedule
}

// ---------------------------------------------------------------- sessions

function recordEvent(
  s: State,
  session: MeetingSession,
  type: SessionEventType,
  actor: User,
  note: string | null = null
) {
  const ms = nowMs()
  s.events.push({
    id: uuidv7(ms),
    sessionId: session.id,
    type,
    occurredAt: toInstant(ms),
    actorId: actor.id,
    note,
  })
}

function sessionFor(s: State, id: Uuid) {
  return found(sessionOf(s, id), "session")
}

function assertStatus(
  session: MeetingSession,
  expected: MeetingSession["status"],
  message: Message
) {
  if (session.status !== expected) throw ruleViolation(message)
}

export function openSession(s: State, actor: User, id: Uuid): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "RECORD_ATTENDANCE", { serviceId: session.serviceId, stageId: session.stageId })
  if (session.status === "active") return session
  assertStatus(
    session,
    "scheduled",
    session.status === "canceled"
      ? msg("errors.meetings.sessionCanceled")
      : msg("errors.meetings.attendanceClosed")
  )
  if (localDateOf(session.startsAt) > today()) {
    throw ruleViolation(msg("errors.meetings.opensOnTheDay"))
  }
  const ms = nowMs()
  session.status = "active"
  session.openedAt ??= toInstant(ms)
  recordEvent(s, session, "opened", actor)
  return session
}

export function closeSession(s: State, actor: User, id: Uuid): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "RECORD_ATTENDANCE", { serviceId: session.serviceId, stageId: session.stageId })
  assertStatus(session, "active", msg("errors.meetings.onlyActiveCanClose"))
  const ms = nowMs()
  session.status = "completed"
  session.closedAt = toInstant(ms)
  session.closedBy = actor.id
  recordEvent(s, session, "closed", actor)
  return session
}

export function reopenSession(
  s: State,
  actor: User,
  id: Uuid,
  reason: string | null
): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "REOPEN_SESSION", session.serviceId, msg("errors.meetings.reopenLeadersOnly"))
  assertStatus(session, "completed", msg("errors.meetings.onlyCompletedCanReopen"))
  const v = new Violations()
  const note = v.optionalText("reason", reason, 200)
  v.throwIfAny()
  session.status = "active"
  recordEvent(s, session, "reopened", actor, note)
  return session
}

export function cancelSession(
  s: State,
  actor: User,
  id: Uuid,
  reason: string | null
): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "MANAGE_SESSIONS", session.serviceId)
  assertStatus(session, "scheduled", msg("errors.meetings.onlyScheduledCanCancel"))
  const v = new Violations()
  const note = v.optionalText("reason", reason, 200)
  v.throwIfAny()
  session.status = "canceled"
  session.cancelReason = note
  session.overridden = true
  recordEvent(s, session, "canceled", actor, note)
  return session
}

export type MoveInput = { date: string; startTime: string; endTime: string | null }

function moveTimes(input: MoveInput) {
  const v = new Violations()
  const date = v.date("date", input.date)
  const start = v.time("startTime", input.startTime)
  const end = v.time("endTime", input.endTime, false)
  if (start && end && !v.has("startTime") && !v.has("endTime") && end <= start) {
    v.add("endTime", msg("errors.meetings.sessionEndAfterStart"))
  }
  v.throwIfAny()
  return {
    startsAt: localInstant(date!, start!),
    endsAt: end ? localInstant(date!, end) : null,
  }
}

/** Moves this one session. The schedule and its other sessions stay as they are. */
export function moveSession(s: State, actor: User, id: Uuid, input: MoveInput): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "MANAGE_SESSIONS", session.serviceId)
  assertStatus(session, "scheduled", msg("errors.meetings.onlyScheduledCanMove"))
  const { startsAt, endsAt } = moveTimes(input)
  if (epochOf(startsAt) <= nowMs()) {
    throw ruleViolation(msg("errors.meetings.chooseFutureTime"))
  }
  const from = session.startsAt
  session.startsAt = startsAt
  session.endsAt = endsAt
  session.overridden = true
  // A move keeps the previous start in the note, so the history can show where it was.
  recordEvent(s, session, "moved", actor, from)
  return session
}

export function editSessionDetails(
  s: State,
  actor: User,
  id: Uuid,
  input: { title: string; location: string | null }
): MeetingSession {
  const session = sessionFor(s, id)
  authorize(actor, "MANAGE_SESSIONS", session.serviceId)
  if (session.status === "canceled") throw ruleViolation(msg("errors.meetings.sessionCanceled"))
  const v = new Violations()
  const title = v.name("title", input.title, 120, msg("errors.meetings.titleRequired"))
  const location = v.optionalText("location", input.location, 120)
  v.throwIfAny()
  session.title = title
  session.location = location
  session.overridden = true
  recordEvent(s, session, "edited", actor)
  return session
}

/**
 * Creates the session for a future occurrence ahead of time, so it can be
 * canceled or moved before the generator would have created it. The generator
 * then finds it and leaves it alone.
 */
export function materializeOccurrence(
  s: State,
  actor: User,
  scheduleId: Uuid,
  date: LocalDate
): MeetingSession {
  const schedule = found(scheduleOf(s, scheduleId), "schedule")
  authorize(actor, "MANAGE_SESSIONS", schedule.serviceId)
  const existing = sessionForOccurrence(s, schedule.id, date)
  if (existing) return existing
  if (!occursOn(schedule.recurrence, date)) {
    throw ruleViolation(msg("errors.meetings.noMeetingOnDate"))
  }
  if (!schedule.active) throw ruleViolation(msg("errors.meetings.scheduleInactive"))
  const occurrence = occurrenceOn(schedule, date)!
  const session = sessionFromOccurrence(schedule, occurrence, nowMs())
  s.sessions.push(session)
  return session
}

export type OneOffInput = {
  serviceId: Uuid
  stageId: Uuid | null
  title: string
  location: string | null
  date: string
  startTime: string
  endTime: string | null
  rosterMode: RosterMode
}

/** A session that does not come from a schedule, e.g. an extra rehearsal. */
export function createOneOffSession(s: State, actor: User, input: OneOffInput): MeetingSession {
  authorize(actor, "MANAGE_SESSIONS", input.serviceId)
  const v = new Violations()
  const service = serviceOf(s, input.serviceId)
  if (!service) v.add("serviceId", msg("errors.meetings.chooseService"))
  else if (isArchived(service)) {
    v.add("serviceId", msg("errors.meetings.serviceArchived", { name: service.name }))
  }
  let stageId: Uuid | null = null
  if (input.stageId) {
    const stage = stageOf(s, input.stageId)
    if (!stage || stage.serviceId !== service?.id)
      v.add("stageId", msg("errors.meetings.chooseStage"))
    else if (isArchived(stage)) {
      v.add("stageId", msg("errors.meetings.stageArchived", { name: stage.name }))
    } else stageId = stage.id
  }
  const title = v.name("title", input.title, 120, msg("errors.meetings.titleRequired"))
  const location = v.optionalText("location", input.location, 120)
  if (input.rosterMode !== "expected" && input.rosterMode !== "open")
    v.add("rosterMode", msg("errors.meetings.chooseRosterMode"))
  let times: { startsAt: string; endsAt: string | null } | null = null
  try {
    times = moveTimes({ date: input.date, startTime: input.startTime, endTime: input.endTime })
  } catch (e) {
    const problem = (e as { problem?: { fieldErrors?: Record<string, Message> } }).problem
    for (const [field, message] of Object.entries(problem?.fieldErrors ?? {})) v.add(field, message)
  }
  v.throwIfAny()
  const ms = nowMs()
  const session: MeetingSession = {
    id: uuidv7(ms),
    serviceId: service!.id,
    stageId,
    scheduleId: null,
    occurrenceDate: input.date,
    title,
    location,
    startsAt: times!.startsAt,
    endsAt: times!.endsAt,
    status: "scheduled",
    rosterMode: input.rosterMode,
    overridden: false,
    cancelReason: null,
    openedAt: null,
    closedAt: null,
    closedBy: null,
    createdAt: toInstant(ms),
  }
  s.sessions.push(session)
  return session
}
