import { msg } from "@/i18n/message"
import type { Session, SessionEventType, Uuid } from "@/lib/domain/types"
import { ruleViolation } from "@/server/errors"

import { requireIn } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { personOf, sessionOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

function event(
  s: State,
  session: Session,
  type: SessionEventType,
  actorId: Uuid,
  note: string | null = null
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

function sessionFor(
  actor: Actor,
  sessionId: Uuid,
  permission: "attendance.record" | "attendance.correct"
) {
  const session = found(sessionOf(actor.state, sessionId), "session")
  requireIn(
    actor.state,
    actor.viewer,
    permission,
    { serviceId: session.serviceId, stageId: session.stageId },
    "session"
  )

  return session
}

export function openSession(actor: Actor, sessionId: Uuid) {
  const session = sessionFor(actor, sessionId, "attendance.record")

  if (session.status !== "scheduled") {
    throw ruleViolation(msg("errors.attendance.notScheduled"))
  }

  if (session.date !== today()) {
    throw ruleViolation(msg("errors.attendance.notToday"))
  }

  session.status = "open"
  session.openedAt = now()
  event(actor.state, session, "opened", actor.viewer.id)
}

export function closeSession(actor: Actor, sessionId: Uuid) {
  const session = sessionFor(actor, sessionId, "attendance.record")

  if (session.status !== "open") {
    throw ruleViolation(msg("errors.attendance.notOpen"))
  }

  session.status = "closed"
  session.closedAt = now()
  session.closedBy = actor.viewer.id
  event(actor.state, session, "closed", actor.viewer.id)
}

export function reopenSession(actor: Actor, sessionId: Uuid, reason: string) {
  const session = sessionFor(actor, sessionId, "attendance.correct")

  if (session.status !== "closed") {
    throw ruleViolation(msg("errors.attendance.notClosed"))
  }

  const v = new Violations()
  const clean = v.optionalText("reason", reason, 300)

  if (!clean) {
    v.add("reason", msg("errors.attendance.reasonRequired"))
  }

  v.throwIfAny()
  session.status = "open"
  session.closedAt = null
  session.closedBy = null
  event(actor.state, session, "reopened", actor.viewer.id, clean)
}

export function setPresent(actor: Actor, sessionId: Uuid, personId: Uuid, present: boolean) {
  const session = sessionFor(actor, sessionId, "attendance.record")
  const s = actor.state

  if (session.status !== "open") {
    throw ruleViolation(msg("errors.attendance.notOpen"))
  }

  found(personOf(s, personId), "person")
  const current = s.attendance.find(
    (a) => a.sessionId === session.id && a.personId === personId && a.removedAt === null
  )

  if (present && !current) {
    s.attendance.push({
      id: uuidv7(nowMs()),
      sessionId: session.id,
      personId,
      recordedAt: now(),
      recordedBy: actor.viewer.id,
      removedAt: null,
      removedBy: null,
      removalReason: null,
    })
  }

  if (!present && current) {
    current.removedAt = now()
    current.removedBy = actor.viewer.id
  }
}
