import "server-only"

import { fullName, nameKey } from "@/lib/domain/names"
import { can, isAdministrator } from "@/lib/domain/policy"
import { addDays, localTimeOf, toInstant } from "@/lib/domain/time"
import type { Attendance, Membership, Person, Role, User, Uuid } from "@/lib/domain/types"
import { msg } from "@/i18n/message"
import { ProblemError, ruleViolation } from "@/server/errors"

import { nowMs, today } from "../clock"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import {
  currentAttendance,
  isArchived,
  isCurrentOn,
  personOf,
  serviceOf,
  sessionOf,
  stageOf,
  userOf,
} from "../selectors"
import type { State } from "../state"

// -------------------------------------------------------------- attendance

/** Marks a person present. Only while the session is taking attendance; never twice. */
export function markPresent(s: State, actor: User, sessionId: Uuid, personId: Uuid): Attendance {
  const session = found(sessionOf(s, sessionId), "session")
  authorize(actor, "RECORD_ATTENDANCE", { serviceId: session.serviceId, stageId: session.stageId })
  const person = found(personOf(s, personId), "person")
  if (session.status === "scheduled") throw ruleViolation(msg("errors.attendance.openFirst"))
  if (session.status === "completed") throw ruleViolation(msg("errors.attendance.closedReopen"))
  if (session.status === "canceled") throw ruleViolation(msg("errors.meetings.sessionCanceled"))
  if (person.status === "inactive") {
    throw ruleViolation(msg("errors.attendance.personInactive", { name: fullName(person) }))
  }
  const existing = currentAttendance(s, sessionId).find((a) => a.personId === personId)
  if (existing) {
    const by = userOf(s, existing.recordedBy)
    const values = { name: fullName(person), time: localTimeOf(existing.recordedAt) }
    throw ruleViolation(
      by
        ? msg("errors.attendance.alreadyPresentBy", { ...values, by: by.displayName })
        : msg("errors.attendance.alreadyPresent", values)
    )
  }
  const ms = nowMs()
  const attendance: Attendance = {
    id: uuidv7(ms),
    sessionId,
    personId,
    recordedAt: toInstant(ms),
    recordedBy: actor.id,
    removedAt: null,
    removedBy: null,
    removalReason: null,
  }
  s.attendance.push(attendance)
  return attendance
}

/** Removes a "present" mark. The entry stays in the history with who removed it, when and why. */
export function removeAttendance(
  s: State,
  actor: User,
  attendanceId: Uuid,
  reason: string | null
): Attendance {
  const attendance = found(
    s.attendance.find((a) => a.id === attendanceId),
    "attendance"
  )
  const session = sessionOf(s, attendance.sessionId)!
  authorize(actor, "RECORD_ATTENDANCE", { serviceId: session.serviceId, stageId: session.stageId })
  if (attendance.removedAt) throw ruleViolation(msg("errors.attendance.alreadyRemoved"))
  if (session.status !== "active") throw ruleViolation(msg("errors.attendance.closedReopen"))
  const v = new Violations()
  const note = v.optionalText("reason", reason, 200)
  v.throwIfAny()
  attendance.removedAt = toInstant(nowMs())
  attendance.removedBy = actor.id
  attendance.removalReason = note
  return attendance
}

// ------------------------------------------------------------------ people

export type PersonInput = { firstName: string; lastName: string; displayName?: string | null }

function validatePerson(input: PersonInput) {
  const v = new Violations()
  const firstName = v.name("firstName", input.firstName, 80, msg("errors.people.firstNameRequired"))
  const lastName = v.name("lastName", input.lastName, 80, msg("errors.people.lastNameRequired"))
  const displayName = v.optionalText("displayName", input.displayName, 120)
  return { v, firstName, lastName, displayName }
}

/** Who may edit a person: administrators, or anyone who manages members where the person belongs today. */
function authorizePerson(s: State, actor: User, person: Person) {
  if (isAdministrator(actor)) return
  const date = today()
  const placements = s.memberships.filter((m) => m.personId === person.id && isCurrentOn(m, date))
  if (!placements.some((m) => can(actor, "MANAGE_MEMBERS", m.serviceId, m.stageId))) {
    throw new ProblemError({
      status: 403,
      detail: msg("errors.people.editOutsideServices", { name: fullName(person) }),
    })
  }
}

export function possibleDuplicates(
  s: State,
  firstName: string,
  lastName: string,
  exceptId?: Uuid
): Person[] {
  const key = nameKey(`${firstName} ${lastName}`)
  return s.persons.filter((p) => p.id !== exceptId && nameKey(fullName(p)) === key)
}

export function createPerson(
  s: State,
  actor: User,
  input: PersonInput & { serviceId: Uuid | null; stageId: Uuid | null; allowDuplicate?: boolean }
): { person: Person; membership: Membership | null } {
  if (input.serviceId) {
    authorize(
      actor,
      "MANAGE_MEMBERS",
      { serviceId: input.serviceId, stageId: input.stageId },
      msg("errors.people.addOutsideServices")
    )
  } else if (!isAdministrator(actor)) {
    throw new ProblemError({
      status: 422,
      fieldErrors: { serviceId: msg("errors.people.chooseJoinService") },
    })
  }
  const { v, firstName, lastName, displayName } = validatePerson(input)
  if (input.serviceId) checkPlacement(s, v, input.serviceId, input.stageId)
  v.throwIfAny()
  if (!input.allowDuplicate) {
    const namesakes = possibleDuplicates(s, firstName, lastName)
    if (namesakes.length > 0) {
      throw new ProblemError({
        status: 409,
        title: msg("errors.people.duplicateTitle"),
        detail: msg("errors.people.duplicate", {
          count: namesakes.length,
          name: `${firstName} ${lastName}`,
        }),
      })
    }
  }
  const ms = nowMs()
  const person: Person = {
    id: uuidv7(ms),
    firstName,
    lastName,
    displayName,
    status: "active",
    createdAt: toInstant(ms),
  }
  s.persons.push(person)
  const membership = input.serviceId
    ? addMembershipRow(s, person.id, input.serviceId, input.stageId)
    : null
  return { person, membership }
}

export function updatePerson(s: State, actor: User, personId: Uuid, input: PersonInput): Person {
  const person = found(personOf(s, personId), "person")
  authorizePerson(s, actor, person)
  const { v, firstName, lastName, displayName } = validatePerson(input)
  v.throwIfAny()
  person.firstName = firstName
  person.lastName = lastName
  person.displayName = displayName
  return person
}

export function setPersonStatus(
  s: State,
  actor: User,
  personId: Uuid,
  status: Person["status"]
): Person {
  const person = found(personOf(s, personId), "person")
  authorizePerson(s, actor, person)
  person.status = status
  return person
}

function checkPlacement(s: State, v: Violations, serviceId: Uuid, stageId: Uuid | null) {
  const service = serviceOf(s, serviceId)
  if (!service) return v.add("serviceId", msg("errors.meetings.chooseService"))
  if (isArchived(service)) {
    return v.add("serviceId", msg("errors.meetings.serviceArchived", { name: service.name }))
  }
  if (stageId) {
    const stage = stageOf(s, stageId)
    if (!stage || stage.serviceId !== serviceId) {
      v.add("stageId", msg("errors.meetings.chooseStage"))
    } else if (isArchived(stage)) {
      v.add("stageId", msg("errors.meetings.stageArchived", { name: stage.name }))
    }
  }
}

function addMembershipRow(
  s: State,
  personId: Uuid,
  serviceId: Uuid,
  stageId: Uuid | null
): Membership {
  const m: Membership = {
    id: uuidv7(nowMs()),
    personId,
    serviceId,
    stageId,
    startsOn: today(),
    endsOn: null,
  }
  s.memberships.push(m)
  return m
}

export function addMembership(
  s: State,
  actor: User,
  personId: Uuid,
  serviceId: Uuid,
  stageId: Uuid | null
): Membership {
  const person = found(personOf(s, personId), "person")
  authorize(
    actor,
    "MANAGE_MEMBERS",
    { serviceId, stageId },
    msg("errors.people.addOutsideServices")
  )
  const v = new Violations()
  checkPlacement(s, v, serviceId, stageId)
  v.throwIfAny()
  const date = today()
  const open = s.memberships.find(
    (m) =>
      m.personId === personId &&
      m.serviceId === serviceId &&
      m.stageId === stageId &&
      isCurrentOn(m, date)
  )
  if (open) {
    const where = stageId ? stageOf(s, stageId)!.name : serviceOf(s, serviceId)!.name
    throw ruleViolation(msg("errors.people.alreadyIn", { name: fullName(person), where }))
  }
  return addMembershipRow(s, personId, serviceId, stageId)
}

/**
 * Ends a membership. It ends yesterday, so the person leaves today's roster;
 * a membership that only started today is removed instead (it was a mistake).
 */
export function endMembership(s: State, actor: User, membershipId: Uuid): Membership {
  const m = found(
    s.memberships.find((x) => x.id === membershipId),
    "membership"
  )
  authorize(
    actor,
    "MANAGE_MEMBERS",
    { serviceId: m.serviceId, stageId: m.stageId },
    msg("errors.people.membershipOutsideServices")
  )
  if (m.endsOn !== null && m.endsOn < today()) {
    throw ruleViolation(msg("errors.people.membershipEnded"))
  }
  if (m.startsOn >= today()) {
    s.memberships = s.memberships.filter((x) => x.id !== m.id)
    return m
  }
  m.endsOn = addDays(today(), -1)
  return m
}

/** Moves a person to another stage of the same service from today on. */
export function moveMembership(
  s: State,
  actor: User,
  membershipId: Uuid,
  stageId: Uuid | null
): Membership {
  const m = found(
    s.memberships.find((x) => x.id === membershipId),
    "membership"
  )
  authorize(
    actor,
    "MANAGE_MEMBERS",
    { serviceId: m.serviceId, stageId: m.stageId },
    msg("errors.people.membershipOutsideServices")
  )
  authorize(
    actor,
    "MANAGE_MEMBERS",
    { serviceId: m.serviceId, stageId },
    msg("errors.people.moveOutsideStages")
  )
  if (m.stageId === stageId) return m
  const v = new Violations()
  checkPlacement(s, v, m.serviceId, stageId)
  v.throwIfAny()
  if (m.startsOn >= today()) {
    m.stageId = stageId
    return m
  }
  m.endsOn = addDays(today(), -1)
  return addMembershipRow(s, m.personId, m.serviceId, stageId)
}

// ------------------------------------------------------------ users & roles

export function assignRole(
  s: State,
  actor: User,
  userId: Uuid,
  role: Role,
  serviceId: Uuid | null,
  stageId: Uuid | null = null
): User {
  authorize(actor, "MANAGE_USERS", null, msg("errors.roles.adminOnly"))
  const target = found(userOf(s, userId), "user")
  const v = new Violations()
  if (role === "administrator" || role === "parent") serviceId = null
  else if (!serviceId) v.add("serviceId", msg("errors.roles.chooseService"))
  else {
    const service = serviceOf(s, serviceId)
    if (!service) v.add("serviceId", msg("errors.meetings.chooseService"))
    else if (isArchived(service)) {
      v.add("serviceId", msg("errors.meetings.serviceArchived", { name: service.name }))
    }
    if (stageId) {
      const stage = stageOf(s, stageId)
      if (!stage || stage.serviceId !== serviceId) {
        v.add("stageId", msg("errors.meetings.chooseStage"))
      }
    }
  }
  v.throwIfAny()
  if (
    target.roles.some(
      (r) => r.role === role && r.serviceId === serviceId && r.stageId === (stageId ?? null)
    )
  ) {
    throw ruleViolation(msg("errors.roles.alreadyHasRole", { name: target.displayName }))
  }
  target.roles.push({ role, serviceId, stageId: role === "servant" ? (stageId ?? null) : null })
  return target
}

export function removeRole(
  s: State,
  actor: User,
  userId: Uuid,
  role: Role,
  serviceId: Uuid | null,
  stageId: Uuid | null = null
): User {
  authorize(actor, "MANAGE_USERS", null, msg("errors.roles.adminOnly"))
  const target = found(userOf(s, userId), "user")
  if (target.id === actor.id && role === "administrator") {
    throw ruleViolation(msg("errors.roles.ownAdminRole"))
  }
  target.roles = target.roles.filter(
    (r) => !(r.role === role && r.serviceId === serviceId && r.stageId === stageId)
  )
  return target
}
