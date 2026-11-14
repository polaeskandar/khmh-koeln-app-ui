import { msg } from "@/i18n/message"
import type { Uuid } from "@/lib/domain/types"
import { notFound, ruleViolation } from "@/server/errors"

import { authorize, canSeeSession, sessionRef } from "../access"
import { now, nowMs, today } from "../clock"
import { found } from "../guard"
import { uuidv7 } from "../ids"
import { personOf, sessionOf } from "../selectors"

import type { Actor } from "./accounts"

function sessionFor(
  actor: Actor,
  sessionId: Uuid,
  permission: "session.takeAttendance" | "session.correctAttendance"
) {
  const session = found(sessionOf(actor.state, sessionId), "session")

  if (!canSeeSession(actor.state, actor.viewer, session)) {
    throw notFound("session")
  }

  authorize(actor.state, actor.viewer, permission, sessionRef(session.id))

  return session
}

export function openSession(actor: Actor, sessionId: Uuid) {
  const session = sessionFor(actor, sessionId, "session.takeAttendance")

  if (session.status !== "scheduled") {
    throw ruleViolation(msg("errors.attendance.notScheduled"))
  }

  if (session.date !== today()) {
    throw ruleViolation(msg("errors.attendance.notToday"))
  }

  session.status = "open"
  session.openedAt = now()
}

export function closeSession(actor: Actor, sessionId: Uuid) {
  const session = sessionFor(actor, sessionId, "session.takeAttendance")

  if (session.status !== "open") {
    throw ruleViolation(msg("errors.attendance.notOpen"))
  }

  session.status = "closed"
  session.closedAt = now()
  session.closedBy = actor.viewer.id
}

export function reopenSession(actor: Actor, sessionId: Uuid) {
  const session = sessionFor(actor, sessionId, "session.correctAttendance")

  if (session.status !== "closed") {
    throw ruleViolation(msg("errors.attendance.notClosed"))
  }

  session.status = "open"
  session.closedAt = null
  session.closedBy = null
}

export function setPresent(actor: Actor, sessionId: Uuid, personId: Uuid, present: boolean) {
  const session = sessionFor(actor, sessionId, "session.takeAttendance")
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
