import { msg } from "@/i18n/message"
import { planDates, ruleProblems } from "@/lib/domain/planning"
import { addDays, compareTime, isValidLocalDate, isValidLocalTime } from "@/lib/domain/time"
import type {
  AnnualPlan,
  LocalDate,
  LocalTime,
  PlanDecision,
  PlanRule,
  Schedule,
  Session,
  Uuid,
} from "@/lib/domain/types"
import { forbidden, invalid, ruleViolation } from "@/server/errors"

import { can, requireIn } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { materialize, newSession, occasionHits } from "../scheduling"
import { hasAttendance, planOf, scheduleOf, sessionOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

const unitOf = (x: { serviceId: Uuid; stageId: Uuid | null }) => ({
  serviceId: x.serviceId,
  stageId: x.stageId,
})

function managedSchedule({ state: s, viewer }: Actor, scheduleId: Uuid): Schedule {
  const schedule = found(scheduleOf(s, scheduleId), "schedule")
  requireIn(s, viewer, "schedule.manage", unitOf(schedule), "schedule")

  return schedule
}

function checkRule(rule: PlanRule, year: number) {
  const problems = ruleProblems(rule, year)
  const fields = Object.fromEntries(
    Object.entries(problems).map(([field, problem]) => [field, msg(`errors.plans.${problem}`)])
  )

  if (rule.location !== null && rule.location.length > 120) {
    fields.location = msg("errors.validation.tooLong", { max: 120 })
  }

  if (Object.keys(fields).length > 0) {
    throw invalid(fields)
  }

  if (planDates(rule, year).length === 0) {
    throw invalid({ startsOn: msg("errors.plans.noDates") })
  }
}

function checkDecisions(
  { state: s, viewer }: Actor,
  schedule: Schedule,
  year: number,
  decisions: Record<LocalDate, PlanDecision>
) {
  const hits = occasionHits(s, schedule.serviceId, year)
  const keepsMandatory = Object.entries(decisions).some(
    ([date, decision]) => decision === "keep" && hits[date]?.some((h) => h.mode === "mandatory")
  )

  if (keepsMandatory && !can(s, viewer, "services.manage")) {
    throw forbidden(msg("errors.plans.mandatoryException"))
  }
}

export type PlanInput = {
  scheduleId: Uuid
  year: number
  rule: PlanRule
  decisions: Record<LocalDate, PlanDecision>
  version: number | null
  confirm: boolean
}

export function savePlan(actor: Actor, input: PlanInput) {
  const s = actor.state
  const schedule = managedSchedule(actor, input.scheduleId)

  if (input.year < Number(today().slice(0, 4)) || input.year > Number(today().slice(0, 4)) + 2) {
    throw ruleViolation(msg("errors.plans.year"))
  }

  checkRule(input.rule, input.year)
  checkDecisions(actor, schedule, input.year, input.decisions)
  const existing = planOf(s, schedule.id, input.year)

  if (existing?.status === "confirmed") {
    throw ruleViolation(msg("errors.plans.alreadyConfirmed"))
  }

  if ((existing?.version ?? null) !== input.version) {
    throw ruleViolation(msg("errors.plans.stale"))
  }

  const plan: AnnualPlan = existing ?? {
    id: uuidv7(nowMs()),
    scheduleId: schedule.id,
    year: input.year,
    status: "draft",
    rule: input.rule,
    decisions: {},
    version: 0,
    updatedAt: now(),
    updatedBy: actor.viewer.id,
    confirmedAt: null,
    confirmedBy: null,
  }

  if (!existing) {
    s.plans.push(plan)
  }

  plan.rule = { ...input.rule }
  plan.decisions = { ...input.decisions }
  plan.version++
  plan.updatedAt = now()
  plan.updatedBy = actor.viewer.id

  if (!input.confirm) {
    return { created: 0 }
  }

  plan.status = "confirmed"
  plan.confirmedAt = now()
  plan.confirmedBy = actor.viewer.id

  return { created: materialize(s, schedule, plan, () => uuidv7(nowMs()), now()) }
}

export function discardDraft(actor: Actor, scheduleId: Uuid, year: number) {
  const schedule = managedSchedule(actor, scheduleId)
  const plan = found(planOf(actor.state, schedule.id, year), "plan")

  if (plan.status !== "draft") {
    throw ruleViolation(msg("errors.plans.alreadyConfirmed"))
  }

  actor.state.plans.splice(actor.state.plans.indexOf(plan), 1)
}

export type ChangeOutcome = { replaced: number; kept: Session[]; added: number }

function isUntouched(s: State, x: Session): boolean {
  return (
    x.kind === "recurring" &&
    !x.changedByHand &&
    (x.status === "scheduled" || x.status === "canceled") &&
    !hasAttendance(s, x.id)
  )
}

export function changePlan(
  actor: Actor,
  input: {
    scheduleId: Uuid
    year: number
    from: LocalDate
    rule: PlanRule
    version: number
    dryRun: boolean
  }
): ChangeOutcome {
  const s = actor.state
  const schedule = managedSchedule(actor, input.scheduleId)
  const plan = found(planOf(s, schedule.id, input.year), "plan")

  if (plan.status !== "confirmed") {
    throw ruleViolation(msg("errors.plans.notConfirmed"))
  }

  if (plan.version !== input.version) {
    throw ruleViolation(msg("errors.plans.stale"))
  }

  if (
    !isValidLocalDate(input.from) ||
    input.from <= today() ||
    !input.from.startsWith(`${input.year}-`)
  ) {
    throw invalid({ from: msg("errors.plans.changeFrom") })
  }

  checkRule(input.rule, input.year)
  const affected = s.sessions.filter((x) => x.planId === plan.id && x.date >= input.from)
  const replaced = affected.filter((x) => isUntouched(s, x))
  const kept = affected.filter((x) => !isUntouched(s, x))
  const keptDates = new Set(kept.map((x) => x.originalDate ?? x.date))
  const added = planDates(input.rule, input.year).filter(
    (date) => date >= input.from && !keptDates.has(date)
  ).length

  if (input.dryRun) {
    return { replaced: replaced.length, kept, added }
  }

  const removed = new Set(replaced.map((x) => x.id))
  s.sessions = s.sessions.filter((x) => !removed.has(x.id))
  s.lessons.forEach((lesson) => {
    if (lesson.sessionId && removed.has(lesson.sessionId)) {
      lesson.sessionId = null
    }
  })
  plan.rule = { ...input.rule }
  plan.version++
  plan.updatedAt = now()
  plan.updatedBy = actor.viewer.id
  materialize(s, schedule, plan, () => uuidv7(nowMs()), now(), input.from)

  return { replaced: replaced.length, kept, added }
}

function managedSession(actor: Actor, sessionId: Uuid): Session {
  const session = found(sessionOf(actor.state, sessionId), "session")
  requireIn(actor.state, actor.viewer, "schedule.manage", unitOf(session), "session")

  return session
}

function event(
  s: State,
  session: Session,
  type: "canceled" | "restored" | "rescheduled" | "created",
  actorId: Uuid,
  note: string | null
) {
  s.events.push({
    id: uuidv7(nowMs()),
    sessionId: session.id,
    type,
    occurredAt: now(),
    actorId,
    note,
  })
}

export function cancelSession(actor: Actor, sessionId: Uuid, reason: string | null) {
  const session = managedSession(actor, sessionId)

  if (session.status !== "scheduled") {
    throw ruleViolation(msg("errors.sessions.notScheduled"))
  }

  if (session.date < today()) {
    throw ruleViolation(msg("errors.sessions.inThePast"))
  }

  const v = new Violations()
  const clean = v.optionalText("reason", reason, 300)
  v.throwIfAny()
  session.status = "canceled"
  session.cancelReason = clean
  session.changedByHand = true
  event(actor.state, session, "canceled", actor.viewer.id, clean)
}

function conflict(
  s: State,
  schedule: Schedule,
  date: LocalDate,
  start: LocalTime,
  except: Uuid | null
) {
  return s.sessions.some(
    (x) =>
      x.scheduleId === schedule.id &&
      x.id !== except &&
      x.status !== "canceled" &&
      x.date === date &&
      x.startTime === start
  )
}

export function restoreSession(actor: Actor, sessionId: Uuid) {
  const session = managedSession(actor, sessionId)
  const schedule = found(scheduleOf(actor.state, session.scheduleId), "schedule")

  if (session.status !== "canceled") {
    throw ruleViolation(msg("errors.sessions.notCanceled"))
  }

  if (session.date < today()) {
    throw ruleViolation(msg("errors.sessions.inThePast"))
  }

  if (conflict(actor.state, schedule, session.date, session.startTime, session.id)) {
    throw ruleViolation(msg("errors.sessions.conflict"))
  }

  session.status = "scheduled"
  session.cancelReason = null
  session.occasionId = null
  session.changedByHand = true
  event(actor.state, session, "restored", actor.viewer.id, null)
}

export type SessionTimes = {
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
}

function checkTimes(times: SessionTimes) {
  const v = new Violations()
  v.date("date", times.date)
  v.time("startTime", times.startTime)
  v.time("endTime", times.endTime, false)
  const location = v.optionalText("location", times.location, 120)

  if (
    times.endTime &&
    isValidLocalTime(times.endTime) &&
    isValidLocalTime(times.startTime) &&
    compareTime(times.endTime, times.startTime) <= 0
  ) {
    v.add("endTime", msg("errors.plans.endBeforeStart"))
  }

  if (!v.has("date") && times.date < today()) {
    v.add("date", msg("errors.sessions.inThePast"))
  }

  if (!v.has("date") && times.date > addDays(today(), 800)) {
    v.add("date", msg("errors.sessions.tooFar"))
  }

  v.throwIfAny()

  return { ...times, location }
}

export function rescheduleSession(actor: Actor, sessionId: Uuid, input: SessionTimes) {
  const session = managedSession(actor, sessionId)
  const schedule = found(scheduleOf(actor.state, session.scheduleId), "schedule")

  if (session.status !== "scheduled") {
    throw ruleViolation(msg("errors.sessions.notScheduled"))
  }

  const times = checkTimes(input)

  if (conflict(actor.state, schedule, times.date, times.startTime, session.id)) {
    throw ruleViolation(msg("errors.sessions.conflict"))
  }

  const before = `${session.date} ${session.startTime}`
  session.originalDate ??= session.date
  session.date = times.date
  session.startTime = times.startTime
  session.endTime = times.endTime
  session.location = times.location
  session.changedByHand = true
  event(actor.state, session, "rescheduled", actor.viewer.id, before)

  return session
}

export function addOneOffSession(actor: Actor, scheduleId: Uuid, input: SessionTimes) {
  const schedule = managedSchedule(actor, scheduleId)
  const times = checkTimes(input)

  if (conflict(actor.state, schedule, times.date, times.startTime, null)) {
    throw ruleViolation(msg("errors.sessions.conflict"))
  }

  const session = newSession(
    schedule,
    { kind: "oneOff", changedByHand: true, ...times },
    uuidv7(nowMs()),
    now()
  )
  actor.state.sessions.push(session)
  event(actor.state, session, "created", actor.viewer.id, null)

  return session
}
