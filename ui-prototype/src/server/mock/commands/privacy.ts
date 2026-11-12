import { msg } from "@/i18n/message"
import { fullName } from "@/lib/domain/names"
import { oneMonthAfter } from "@/lib/domain/privacy"
import type { DataRequest, DataRequestChannel, Uuid } from "@/lib/domain/types"
import { ruleViolation } from "@/server/errors"

import { authorize } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { accountOfPerson, personOf, unitLabel } from "../selectors"
import type { State } from "../state"

import { type Actor, forgetAccount } from "./accounts"
import { ensureAccessManagerRemains } from "./access"

export function recordRequest(
  { state: s, viewer }: Actor,
  input: {
    kind: DataRequest["kind"]
    personId: Uuid
    requestedBy: string
    channel: Exclude<DataRequestChannel, "app">
    note: string | null
  }
) {
  authorize(s, viewer, "data.manage")
  const person = found(personOf(s, input.personId), "person")
  const v = new Violations()
  const requestedBy = v.name(
    "requestedBy",
    input.requestedBy,
    200,
    msg("errors.privacy.requestedByRequired")
  )
  const note = v.optionalText("note", input.note, 1000)
  v.throwIfAny()
  const request = newRequest(s, input.kind, person.id, requestedBy, input.channel, note)

  return request
}

function newRequest(
  s: State,
  kind: DataRequest["kind"],
  personId: Uuid,
  requestedBy: string,
  channel: DataRequestChannel,
  note: string | null
) {
  const request: DataRequest = {
    id: uuidv7(nowMs()),
    kind,
    personId,
    subjectName: fullName(personOf(s, personId)!),
    erasedSubject: null,
    requestedBy,
    channel,
    receivedAt: now(),
    dueOn: oneMonthAfter(today()),
    note,
    status: "open",
    outcome: null,
    declineReason: null,
    closedAt: null,
    closedBy: null,
  }
  s.dataRequests.push(request)

  return request
}

export function requestOwnErasure({ state: s, viewer }: Actor) {
  const open = s.dataRequests.find(
    (r) => r.personId === viewer.personId && r.kind === "erasure" && r.status === "open"
  )

  if (open) {
    throw ruleViolation(msg("errors.privacy.alreadyRequested"))
  }

  const person = personOf(s, viewer.personId)!

  return newRequest(s, "erasure", person.id, fullName(person), "app", null)
}

function openRequest({ state: s, viewer }: Actor, requestId: Uuid) {
  authorize(s, viewer, "data.manage")
  const request = found(
    s.dataRequests.find((r) => r.id === requestId),
    "request"
  )

  if (request.status !== "open") {
    throw ruleViolation(msg("errors.privacy.closed"))
  }

  return request
}

export function completeCopy(actor: Actor, requestId: Uuid) {
  const request = openRequest(actor, requestId)

  if (request.kind !== "copy") {
    throw ruleViolation(msg("errors.privacy.wrongKind"))
  }

  request.status = "done"
  request.closedAt = now()
  request.closedBy = actor.viewer.id
}

export function declineRequest(actor: Actor, requestId: Uuid, reason: string) {
  const request = openRequest(actor, requestId)
  const v = new Violations()
  const clean = v.name("reason", reason, 500, msg("errors.privacy.reasonRequired"))
  v.throwIfAny()
  request.status = "declined"
  request.declineReason = clean
  request.closedAt = now()
  request.closedBy = actor.viewer.id
}

export function erasureImpact(s: State, personId: Uuid) {
  const account = accountOfPerson(s, personId)
  const attendance = s.attendance.filter((a) => a.personId === personId)

  return {
    person: 1,
    account: account ? 1 : 0,
    memberships: s.memberships.filter((m) => m.personId === personId).length,
    attendance: attendance.length,
    completions: s.completions.filter((c) => c.personId === personId).length,
    guardianships: s.guardianships.filter(
      (g) => g.childId === personId || g.accountId === account?.id
    ).length,
    assignments: account ? s.assignments.filter((a) => a.accountId === account.id).length : 0,
  }
}

function describe(s: State, personId: Uuid): string {
  const membership = s.memberships.find((m) => m.personId === personId)

  return membership ? unitLabel(s, membership) : ""
}

export function erase(actor: Actor, requestId: Uuid) {
  const request = openRequest(actor, requestId)

  if (request.kind !== "erasure" || !request.personId) {
    throw ruleViolation(msg("errors.privacy.wrongKind"))
  }

  const s = actor.state
  const personId = request.personId
  const account = accountOfPerson(s, personId)

  if (account?.id === actor.viewer.id) {
    throw ruleViolation(msg("errors.privacy.ownErasure"))
  }

  if (account) {
    ensureAccessManagerRemains(s, { removedAccountId: account.id })
  }

  const outcome = erasureImpact(s, personId)
  const group = describe(s, personId)

  for (const a of s.attendance.filter((x) => x.personId === personId && x.removedAt === null)) {
    const counts = (s.anonymousCounts[a.sessionId] ??= { present: 0 })
    counts.present++
  }

  s.attendance = s.attendance.filter((a) => a.personId !== personId)
  s.memberships = s.memberships.filter((m) => m.personId !== personId)
  s.completions = s.completions.filter((c) => c.personId !== personId)
  s.guardianships = s.guardianships.filter(
    (g) => g.childId !== personId && g.accountId !== account?.id
  )

  if (account) {
    forgetAccount(s, account.id)
  }

  s.persons = s.persons.filter((p) => p.id !== personId)

  for (const r of s.dataRequests.filter((x) => x.personId === personId)) {
    r.personId = null
    r.subjectName = null
    r.erasedSubject = group
  }

  request.status = "done"
  request.outcome = outcome
  request.closedAt = now()
  request.closedBy = actor.viewer.id
}

export function exportPerson(s: State, personId: Uuid) {
  const person = found(personOf(s, personId), "person")
  const account = accountOfPerson(s, personId)

  return {
    exportedAt: now(),
    person: { firstName: person.firstName, lastName: person.lastName },
    account: account
      ? { username: account.username, createdAt: account.createdAt, language: account.language }
      : null,
    groups: s.memberships
      .filter((m) => m.personId === personId)
      .map((m) => ({ group: unitLabel(s, m), from: m.startsOn, until: m.endsOn })),
    attendance: s.attendance
      .filter((a) => a.personId === personId && a.removedAt === null)
      .map((a) => {
        const session = s.sessions.find((x) => x.id === a.sessionId)!

        return { group: unitLabel(s, session), date: session.date }
      }),
    tasksDone: s.completions
      .filter((c) => c.personId === personId && c.undoneAt === null)
      .map((c) => ({ task: s.tasks.find((t) => t.id === c.taskId)?.title, at: c.completedAt })),
    children: account
      ? s.guardianships
          .filter((g) => g.accountId === account.id)
          .map((g) => fullName(personOf(s, g.childId)!))
      : [],
  }
}
