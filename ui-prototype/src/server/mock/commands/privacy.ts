import "server-only"

import { msg } from "@/i18n/message"
import { isAdministrator } from "@/lib/domain/policy"
import { oneMonthAfter } from "@/lib/domain/privacy"
import { epochOf, localDateOf, localInstant, toInstant } from "@/lib/domain/time"
import type { DataRequest, LocalDate, Person, User, Uuid } from "@/lib/domain/types"
import { forbidden, ruleViolation } from "@/server/errors"

import { nowMs, today as clockToday } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import {
  currentAttendance,
  personOf,
  serviceOf,
  sessionDate,
  sessionRoster,
  stageOf,
  userOf,
} from "../selectors"
import type { State } from "../state"

/**
 * Data protection requests (DSGVO Art. 15, 17 and 20) and what carrying them
 * out does to the data.
 *
 * Erasing a member deletes the person record, their memberships, attendance
 * marks, homework reports and parent links. Past attendance totals stay right
 * as anonymous numbers per session. Erasing an account deletes the sign-in,
 * roles and parent links; what the account did for the church (attendance it
 * recorded, lessons it prepared) stays without the name. The request itself
 * is kept as proof that the church answered, with the name replaced by a
 * neutral description.
 */

export type DataRequestInput = {
  kind: DataRequest["kind"]
  personId?: Uuid | null
  userId?: Uuid | null
  requestedBy: string
  channel: Exclude<DataRequest["channel"], "app">
  receivedOn: LocalDate
  note?: string | null
}

/** Records that are deleted by an erasure. */
export type ErasedKind =
  | "person"
  | "memberships"
  | "attendance"
  | "completions"
  | "guardianLinks"
  | "account"
  | "roles"
  | "notes"

/** Records that stay, without the name. */
export type KeptKind =
  | "sessionTotals"
  | "recordedMarks"
  | "reportedCompletions"
  | "lessons"
  | "homework"
  | "sessionHistory"

/** A free-text note that may name the person, for the administrator to review. */
export type Mention = {
  id: string
  where: "sessionNote" | "correctionNote" | "cancelReason" | "lessonNote"
  text: string
  date: LocalDate
  group: string
}

export type Inventory = {
  erase: Partial<Record<ErasedKind, number>>
  keep: Partial<Record<KeptKind, number>>
  mentions: Mention[]
}

const fullName = (p: Person) => `${p.firstName} ${p.lastName}`

function requireAdmin(actor: User) {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.privacy.adminOnly"))
}

/** A member's account, or an account's member record: one person, one request. */
function subjectOf(s: State, personId: Uuid | null, userId: Uuid | null) {
  const user =
    userOf(s, userId) ?? s.users.find((u) => personId !== null && u.personId === personId)
  const person = personOf(s, personId) ?? personOf(s, user?.personId)
  return { person, user }
}

function newRequest(
  s: State,
  input: Omit<
    DataRequest,
    | "id"
    | "dueOn"
    | "status"
    | "outcome"
    | "declineReason"
    | "closedAt"
    | "closedBy"
    | "erasedSubject"
  >
): DataRequest {
  const request: DataRequest = {
    id: uuidv7(epochOf(input.receivedAt)),
    ...input,
    dueOn: oneMonthAfter(localDateOf(input.receivedAt)),
    erasedSubject: null,
    status: "open",
    outcome: null,
    declineReason: null,
    closedAt: null,
    closedBy: null,
  }
  s.dataRequests.push(request)
  return request
}

/** The office records a request that came by email, letter or in person. */
export function recordDataRequest(s: State, actor: User, input: DataRequestInput): DataRequest {
  requireAdmin(actor)
  const v = new Violations()
  const { person, user } = subjectOf(s, input.personId ?? null, input.userId ?? null)
  if (!person && !user) v.add("subject", msg("errors.privacy.chooseSubject"))
  const requestedBy = v.name(
    "requestedBy",
    input.requestedBy,
    200,
    msg("errors.privacy.requestedByRequired")
  )
  const received = v.date("receivedOn", input.receivedOn)
  if (received && received > clockToday()) {
    v.add("receivedOn", msg("errors.privacy.receivedInFuture"))
  }
  const note = v.optionalText("note", input.note, 2000)
  v.throwIfAny()
  const ms = nowMs()
  return newRequest(s, {
    kind: input.kind,
    personId: person?.id ?? null,
    userId: user?.id ?? null,
    subjectName: person ? fullName(person) : user!.displayName,
    requestedBy,
    channel: input.channel,
    receivedAt: received === localDateOf(ms) ? toInstant(ms) : localInstant(received!, "12:00"),
    note,
  })
}

/** Someone asks, from their own account, for their account and data to be deleted. */
export function requestOwnErasure(s: State, actor: User, note: string | null): DataRequest {
  const open = s.dataRequests.find(
    (r) => r.status === "open" && r.kind === "erasure" && r.userId === actor.id
  )
  if (open) throw ruleViolation(msg("errors.privacy.alreadyRequested"))
  const v = new Violations()
  const clean = v.optionalText("note", note, 2000)
  v.throwIfAny()
  return newRequest(s, {
    kind: "erasure",
    personId: actor.personId,
    userId: actor.id,
    subjectName: actor.displayName,
    requestedBy: actor.displayName,
    channel: "app",
    receivedAt: toInstant(nowMs()),
    note: clean,
  })
}

/** The open erasure request someone made about their own account, if any. */
export const ownOpenErasure = (s: State, userId: Uuid) =>
  s.dataRequests.find((r) => r.status === "open" && r.kind === "erasure" && r.userId === userId)

/** The group a member was last in, for the log: "3rd Class", "Youth Meeting". */
function lastGroupOf(s: State, personId: Uuid): string | null {
  const last = s.memberships
    .filter((m) => m.personId === personId)
    .sort((a, b) => (b.endsOn ?? "9999").localeCompare(a.endsOn ?? "9999"))[0]
  if (!last) return null
  return stageOf(s, last.stageId)?.name ?? serviceOf(s, last.serviceId)?.name ?? null
}

const wordPattern = (word: string) =>
  new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu")

/** Sessions an erased member's attendance counts for: the ones whose attendance was taken, or is past. */
function countedSessions(s: State, today: LocalDate) {
  return s.sessions.filter(
    (x) =>
      x.status === "completed" ||
      x.status === "active" ||
      (x.status === "scheduled" && sessionDate(x) < today)
  )
}

function mentionsOf(s: State, person: Person): Mention[] {
  const names = [person.firstName, person.displayName].filter((n): n is string => !!n)
  const patterns = names.map(wordPattern)
  const mentions = (text: string | null) => !!text && patterns.some((p) => p.test(text))
  const own = s.memberships.filter((m) => m.personId === person.id)
  const stages = new Set(own.map((m) => m.stageId).filter(Boolean))
  const services = new Set(own.map((m) => m.serviceId))
  // Their stages, and meetings of a whole service they belong to.
  const inGroup = (serviceId: Uuid, stageId: Uuid | null) =>
    stageId === null ? services.has(serviceId) : stages.has(stageId)
  const groupName = (serviceId: Uuid, stageId: Uuid | null) =>
    stageOf(s, stageId)?.name ?? serviceOf(s, serviceId)?.name ?? ""
  const found: Mention[] = []
  for (const session of s.sessions) {
    if (!inGroup(session.serviceId, session.stageId)) continue
    const group = groupName(session.serviceId, session.stageId)
    const date = sessionDate(session)
    if (mentions(session.cancelReason)) {
      found.push({
        id: `cancel:${session.id}`,
        where: "cancelReason",
        text: session.cancelReason!,
        date,
        group,
      })
    }
    for (const e of s.events) {
      if (e.sessionId === session.id && e.type !== "moved" && mentions(e.note)) {
        found.push({ id: `event:${e.id}`, where: "sessionNote", text: e.note!, date, group })
      }
    }
    for (const a of s.attendance) {
      if (a.sessionId === session.id && a.personId !== person.id && mentions(a.removalReason)) {
        found.push({
          id: `attendance:${a.id}`,
          where: "correctionNote",
          text: a.removalReason!,
          date,
          group,
        })
      }
    }
  }
  for (const lesson of s.lessons) {
    if (!inGroup(lesson.serviceId, lesson.stageId) || !mentions(lesson.notes)) continue
    found.push({
      id: `lesson:${lesson.id}`,
      where: "lessonNote",
      text: lesson.notes!,
      date: lesson.teachingDate,
      group: groupName(lesson.serviceId, lesson.stageId),
    })
  }
  return found.sort((a, b) => b.date.localeCompare(a.date))
}

/** Everything the app stores about a member and/or an account. */
export function inventoryOf(
  s: State,
  person: Person | undefined,
  user: User | undefined
): Inventory {
  const erase: Inventory["erase"] = {}
  const keep: Inventory["keep"] = {}
  const put = <K extends string>(into: Partial<Record<K, number>>, key: K, n: number) => {
    if (n > 0) into[key] = (into[key] ?? 0) + n
  }
  let mentions: Mention[] = []
  if (person) {
    put(erase, "person", 1)
    put(erase, "memberships", s.memberships.filter((m) => m.personId === person.id).length)
    put(erase, "attendance", s.attendance.filter((a) => a.personId === person.id).length)
    put(erase, "completions", s.completions.filter((c) => c.personId === person.id).length)
    put(erase, "guardianLinks", s.guardians.filter((g) => g.personId === person.id).length)
    put(
      keep,
      "sessionTotals",
      countedSessions(s, clockToday()).filter((x) =>
        currentAttendance(s, x.id).some((a) => a.personId === person.id)
      ).length
    )
    mentions = mentionsOf(s, person)
  }
  if (user) {
    put(erase, "account", 1)
    put(erase, "roles", user.roles.length)
    put(erase, "guardianLinks", s.guardians.filter((g) => g.userId === user.id).length)
    put(
      keep,
      "recordedMarks",
      s.attendance.filter((a) => a.recordedBy === user.id || a.removedBy === user.id).length
    )
    put(
      keep,
      "reportedCompletions",
      s.completions.filter((c) => c.completedBy === user.id || c.undoneBy === user.id).length
    )
    put(
      keep,
      "lessons",
      s.lessons.filter((l) => l.responsibleId === user.id || l.collaboratorIds.includes(user.id))
        .length
    )
    put(keep, "homework", s.homework.filter((h) => h.createdBy === user.id).length)
    put(
      keep,
      "sessionHistory",
      s.events.filter((e) => e.actorId === user.id).length +
        s.sessions.filter((x) => x.closedBy === user.id).length
    )
  }
  return { erase, keep, mentions }
}

function openRequest(s: State, actor: User, id: Uuid): DataRequest {
  requireAdmin(actor)
  const request = found(
    s.dataRequests.find((r) => r.id === id),
    "request"
  )
  if (request.status !== "open") throw ruleViolation(msg("errors.privacy.notOpen"))
  return request
}

function close(request: DataRequest, actor: User, status: DataRequest["status"]) {
  request.status = status
  request.closedAt = toInstant(nowMs())
  request.closedBy = actor.id
}

/** Carries out an erasure request. With clearNotes, the notes that may name the member are emptied too. */
export function eraseData(
  s: State,
  actor: User,
  requestId: Uuid,
  { clearNotes }: { clearNotes: boolean }
): DataRequest {
  const request = openRequest(s, actor, requestId)
  if (request.kind !== "erasure") throw ruleViolation(msg("errors.privacy.notErasure"))
  const { person, user } = subjectOf(s, request.personId, request.userId)
  if (!person && !user) throw ruleViolation(msg("errors.privacy.subjectGone"))
  if (user?.id === actor.id) throw ruleViolation(msg("errors.privacy.ownAccount"))

  const inventory = inventoryOf(s, person, user)
  const outcome: Record<string, number> = { ...inventory.erase }
  const erasedSubject: DataRequest["erasedSubject"] = person
    ? { kind: "member", group: lastGroupOf(s, person.id) }
    : { kind: "account", group: null }

  if (person) {
    // Past totals keep counting the member, as numbers without a name.
    for (const session of countedSessions(s, clockToday())) {
      const onRoster =
        session.rosterMode === "expected" &&
        sessionRoster(s, session).some((p) => p.id === person.id)
      const present = currentAttendance(s, session.id).some((a) => a.personId === person.id)
      if (!onRoster && !present) continue
      const c = (s.anonymousCounts[session.id] ??= { roster: 0, present: 0, rosterPresent: 0 })
      if (onRoster) c.roster += 1
      if (present) c.present += 1
      if (onRoster && present) c.rosterPresent += 1
    }
    if (clearNotes && inventory.mentions.length > 0) {
      const ids = new Set(inventory.mentions.map((m) => m.id))
      for (const x of s.sessions) if (ids.has(`cancel:${x.id}`)) x.cancelReason = null
      for (const e of s.events) if (ids.has(`event:${e.id}`)) e.note = null
      for (const a of s.attendance) if (ids.has(`attendance:${a.id}`)) a.removalReason = null
      for (const l of s.lessons) if (ids.has(`lesson:${l.id}`)) l.notes = null
      outcome.notes = inventory.mentions.length
    }
    s.attendance = s.attendance.filter((a) => a.personId !== person.id)
    s.memberships = s.memberships.filter((m) => m.personId !== person.id)
    s.completions = s.completions.filter((c) => c.personId !== person.id)
    s.guardians = s.guardians.filter((g) => g.personId !== person.id)
    for (const u of s.users) if (u.personId === person.id) u.personId = null
    s.persons = s.persons.filter((p) => p.id !== person.id)
  }

  if (user) {
    // What the account did for the church stays, without saying who did it.
    for (const a of s.attendance) {
      if (a.recordedBy === user.id) a.recordedBy = null
      if (a.removedBy === user.id) a.removedBy = null
    }
    for (const x of s.sessions) if (x.closedBy === user.id) x.closedBy = null
    for (const e of s.events) if (e.actorId === user.id) e.actorId = null
    for (const c of s.completions) if (c.undoneBy === user.id) c.undoneBy = null
    for (const l of s.lessons) l.collaboratorIds = l.collaboratorIds.filter((x) => x !== user.id)
    for (const g of s.guardians) if (g.approvedBy === user.id) g.approvedBy = null
    for (const u of s.users) if (u.approvedBy === user.id) u.approvedBy = null
    for (const r of s.dataRequests) if (r.closedBy === user.id) r.closedBy = null
    s.guardians = s.guardians.filter((g) => g.userId !== user.id)
    s.users = s.users.filter((u) => u.id !== user.id)
  }

  close(request, actor, "done")
  request.outcome = outcome
  // Earlier requests about the same person no longer name them either.
  for (const r of s.dataRequests) {
    const same =
      r === request || (person && r.personId === person.id) || (user && r.userId === user.id)
    if (!same) continue
    r.subjectName = null
    r.erasedSubject = erasedSubject
    r.personId = null
    r.userId = null
  }
  return request
}

/** Closes a copy request once the office has sent the file. */
export function completeCopyRequest(s: State, actor: User, requestId: Uuid): DataRequest {
  const request = openRequest(s, actor, requestId)
  if (request.kind !== "copy") throw ruleViolation(msg("errors.privacy.notCopy"))
  close(request, actor, "done")
  return request
}

/** Declines a request, with the reason the person is told (DSGVO Art. 12(4)). */
export function declineDataRequest(
  s: State,
  actor: User,
  requestId: Uuid,
  reason: string
): DataRequest {
  const request = openRequest(s, actor, requestId)
  const v = new Violations()
  const why = v.optionalText("reason", reason, 2000)
  if (!why) v.add("reason", msg("errors.privacy.declineReasonRequired"))
  v.throwIfAny()
  close(request, actor, "declined")
  request.declineReason = why
  return request
}

/**
 * A copy of everything stored about a member and/or an account (DSGVO
 * Art. 15 and 20), as plain JSON. Other people's contact details are left
 * out (Art. 15(4)).
 */
export function personalData(s: State, person: Person | undefined, user: User | undefined) {
  const groupOf = (serviceId: Uuid, stageId: Uuid | null) => ({
    service: serviceOf(s, serviceId)?.name ?? null,
    stage: stageOf(s, stageId)?.name ?? null,
  })
  const member = person
    ? {
        firstName: person.firstName,
        lastName: person.lastName,
        preferredName: person.displayName,
        status: person.status,
        recordedSince: person.createdAt,
        memberships: s.memberships
          .filter((m) => m.personId === person.id)
          .map((m) => ({ ...groupOf(m.serviceId, m.stageId), from: m.startsOn, until: m.endsOn })),
        attendance: s.attendance
          .filter((a) => a.personId === person.id)
          .map((a) => {
            const session = s.sessions.find((x) => x.id === a.sessionId)
            return {
              meeting: session?.title ?? null,
              date: session ? sessionDate(session) : null,
              markedPresentAt: a.recordedAt,
              removedAt: a.removedAt,
              removalNote: a.removalReason,
            }
          })
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
        homeworkReports: s.completions
          .filter((c) => c.personId === person.id)
          .map((c) => ({
            homework: s.homework.find((h) => h.id === c.assignmentId)?.title ?? null,
            reportedDoneAt: c.completedAt,
            undoneAt: c.undoneAt,
          })),
        parentAccounts: s.guardians
          .filter((g) => g.personId === person.id)
          .map((g) => ({ name: userOf(s, g.userId)?.displayName ?? null, status: g.status })),
      }
    : null
  const account = user
    ? {
        email: user.email,
        name: user.displayName,
        language: user.language,
        createdAt: user.createdAt,
        approvedAt: user.approvedAt,
        privacyNoticeAccepted: { at: user.privacyAcceptedAt, version: user.privacyVersion },
        disabledAt: user.disabledAt,
        roles: user.roles.map((r) => ({
          role: r.role,
          ...(r.serviceId ? groupOf(r.serviceId, r.stageId) : {}),
        })),
        children: s.guardians
          .filter((g) => g.userId === user.id)
          .map((g) => {
            const child = personOf(s, g.personId)
            return { name: child ? fullName(child) : null, status: g.status }
          }),
        homeworkReported: s.completions
          .filter((c) => c.completedBy === user.id)
          .map((c) => {
            const child = personOf(s, c.personId)
            return {
              child: child ? fullName(child) : null,
              homework: s.homework.find((h) => h.id === c.assignmentId)?.title ?? null,
              reportedDoneAt: c.completedAt,
              undoneAt: c.undoneAt,
            }
          }),
      }
    : null
  return {
    about:
      "KHMK Köln: a copy of the personal data stored in the church app (DSGVO Art. 15 and 20).",
    createdAt: toInstant(nowMs()),
    member,
    account,
  }
}

export function personalDataForRequest(s: State, actor: User, requestId: Uuid) {
  requireAdmin(actor)
  const request = found(
    s.dataRequests.find((r) => r.id === requestId),
    "request"
  )
  const { person, user } = subjectOf(s, request.personId, request.userId)
  if (!person && !user) throw ruleViolation(msg("errors.privacy.subjectGone"))
  return { request, data: personalData(s, person, user) }
}

export const ownPersonalData = (s: State, actor: User) =>
  personalData(s, personOf(s, actor.personId), actor)
