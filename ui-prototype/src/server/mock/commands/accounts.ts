import "server-only"

import { msg } from "@/i18n/message"
import { isAdministrator } from "@/lib/domain/policy"
import { PRIVACY_VERSION } from "@/lib/domain/privacy"
import { toInstant } from "@/lib/domain/time"
import type { AgeCheck, GuardianRelationship, Language, User, Uuid } from "@/lib/domain/types"
import { forbidden, ruleViolation } from "@/server/errors"

import { nowMs } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../passwords"
import { isArchived, personOf, serviceOf, stageOf, userOf } from "../selectors"
import type { State } from "../state"

/**
 * Accounts: registration, sign-in and the administrator's approval.
 *
 * Anyone can register, but a new account can't be used until an
 * administrator approves it: for a parent by linking their children, for a
 * servant by giving them a role, for a member by linking the account to their
 * own member record (under 16 only with a parent's or guardian's agreement).
 * Declined registrations are deleted, with everything the person entered
 * (data minimisation, DSGVO Art. 5(1)(c)).
 */

export type RegistrationInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  as: "parent" | "servant" | "member"
  details: string
  serviceId?: Uuid | null
  language: Language
  acceptPrivacy: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const accountByEmail = (s: State, email: string) =>
  s.users.find((u) => u.email.toLowerCase() === normalizeEmail(email))

export function register(s: State, input: RegistrationInput): User {
  const v = new Violations()
  const first = v.name("firstName", input.firstName, 80, msg("errors.accounts.firstNameRequired"))
  const last = v.name("lastName", input.lastName, 80, msg("errors.accounts.lastNameRequired"))
  const email = normalizeEmail(input.email)
  if (email === "") v.add("email", msg("errors.accounts.emailRequired"))
  else if (!EMAIL.test(email) || email.length > 180)
    v.add("email", msg("errors.accounts.emailInvalid"))
  else if (accountByEmail(s, email)) v.add("email", msg("errors.accounts.emailTaken"))
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    v.add("password", msg("errors.accounts.passwordTooShort", { min: MIN_PASSWORD_LENGTH }))
  } else if (input.password.length > 200) {
    v.add("password", msg("errors.validation.tooLong", { max: 200 }))
  }
  const details = (input.details ?? "").trim()
  if (details === "") {
    v.add(
      "details",
      input.as === "parent"
        ? msg("errors.accounts.childrenRequired")
        : input.as === "servant"
          ? msg("errors.accounts.serviceDetailsRequired")
          : msg("errors.accounts.groupsRequired")
    )
  } else if (details.length > 1000)
    v.add("details", msg("errors.validation.tooLong", { max: 1000 }))
  let serviceId: Uuid | null = null
  if (input.as === "servant") {
    const service = serviceOf(s, input.serviceId)
    if (!service || isArchived(service)) v.add("serviceId", msg("errors.accounts.chooseService"))
    else serviceId = service.id
  }
  if (!input.acceptPrivacy) v.add("acceptPrivacy", msg("errors.accounts.acceptPrivacy"))
  v.throwIfAny()

  const ms = nowMs()
  const user: User = {
    id: uuidv7(ms),
    email,
    displayName: `${first} ${last}`,
    personId: null,
    roles: [],
    passwordHash: hashPassword(input.password),
    language: input.language,
    registration: { as: input.as, details, serviceId },
    privacyAcceptedAt: toInstant(ms),
    privacyVersion: PRIVACY_VERSION,
    approvedAt: null,
    approvedBy: null,
    ageCheck: null,
    guardianConsentNote: null,
    disabledAt: null,
    createdAt: toInstant(ms),
  }
  s.users.push(user)
  return user
}

export type SignInResult =
  | { ok: true; user: User }
  /** wrong: unknown email or wrong password (never says which); the others only after a correct password. */
  | { ok: false; reason: "wrong" | "pending" | "disabled" }

export function authenticate(s: State, email: string, password: string): SignInResult {
  const user = accountByEmail(s, email)
  if (!verifyPassword(password, user?.passwordHash ?? null) || !user) {
    return { ok: false, reason: "wrong" }
  }
  if (user.disabledAt) return { ok: false, reason: "disabled" }
  if (!user.approvedAt) return { ok: false, reason: "pending" }
  return { ok: true, user }
}

export type ApprovalInput =
  | { as: "parent"; childIds: Uuid[] }
  | {
      as: "servant"
      role: "servant" | "service_leader"
      serviceId: Uuid
      /** Servants only: narrows the role to one stage. */
      stageId?: Uuid | null
    }
  | {
      as: "member"
      /** The member record the account belongs to. */
      personId: Uuid | null
      /** 16 or older, or under 16 with a parent's or guardian's agreement. */
      ageCheck: AgeCheck | null
      /** Under 16: how the parent or guardian agreed (in person, by letter, …). */
      guardianConsentNote?: string | null
    }

/** The account linked to a member record, if any: a record belongs to at most one account. */
export const accountOfPerson = (s: State, personId: Uuid) =>
  s.users.find((u) => u.personId === personId)

function pendingAccount(s: State, actor: User, userId: Uuid): User {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.accounts.adminOnly"))
  const user = found(userOf(s, userId), "user")
  if (user.approvedAt) throw ruleViolation(msg("errors.accounts.alreadyApproved"))
  return user
}

/**
 * Approves a registration: links the children, gives the role or links the member record, then
 * the account can be used.
 */
export function approveAccount(s: State, actor: User, userId: Uuid, input: ApprovalInput): User {
  const user = pendingAccount(s, actor, userId)
  const ms = nowMs()
  const v = new Violations()
  if (input.as === "member") {
    const person = input.personId ? personOf(s, input.personId) : undefined
    if (!input.personId) v.add("personId", msg("errors.accounts.choosePerson"))
    else if (!person || person.status !== "active") {
      v.add("personId", msg("errors.accounts.personNotFound"))
    } else if (accountOfPerson(s, person.id)) {
      v.add(
        "personId",
        msg("errors.accounts.personHasAccount", { name: `${person.firstName} ${person.lastName}` })
      )
    }
    if (!input.ageCheck) v.add("ageCheck", msg("errors.accounts.chooseAge"))
    const note = (input.guardianConsentNote ?? "").trim()
    if (input.ageCheck === "guardianConsent" && note.length > 200) {
      v.add("guardianConsentNote", msg("errors.validation.tooLong", { max: 200 }))
    }
    v.throwIfAny()
    user.roles = []
    user.personId = person!.id
    user.ageCheck = input.ageCheck
    user.guardianConsentNote = input.ageCheck === "guardianConsent" && note ? note : null
  } else if (input.as === "parent") {
    const children = [...new Set(input.childIds)].map((id) => personOf(s, id))
    if (children.length === 0) v.add("childIds", msg("errors.accounts.chooseChild"))
    if (children.some((c) => !c || c.status !== "active")) {
      v.add("childIds", msg("errors.accounts.childNotFound"))
    }
    v.throwIfAny()
    user.roles = [{ role: "parent", serviceId: null, stageId: null }]
    for (const child of children) {
      const link: GuardianRelationship = {
        id: uuidv7(ms),
        userId: user.id,
        personId: child!.id,
        relationship: "parent",
        status: "approved",
        approvedBy: actor.id,
        approvedAt: toInstant(ms),
        createdAt: toInstant(ms),
      }
      s.guardians.push(link)
    }
  } else {
    const service = serviceOf(s, input.serviceId)
    if (!service || isArchived(service)) {
      v.add("serviceId", msg("errors.accounts.chooseServiceForRole"))
    }
    const stage = input.role === "servant" && input.stageId ? stageOf(s, input.stageId) : null
    if (input.role === "servant" && input.stageId && (!stage || stage.serviceId !== service?.id)) {
      v.add("stageId", msg("errors.accounts.stageNotInService"))
    }
    v.throwIfAny()
    user.roles = [{ role: input.role, serviceId: service!.id, stageId: stage?.id ?? null }]
  }
  user.approvedAt = toInstant(ms)
  user.approvedBy = actor.id
  // The registration text was only needed for this decision.
  user.registration = null
  return user
}

/**
 * Removes the link between an account and its member record, for example when the office linked
 * the wrong person. Reports the account made stay in the history. An account with another role
 * (a parent) keeps it; an account that only had the link goes back to the account requests, so
 * an administrator links it to the right record or declines it.
 */
export function unlinkMember(s: State, actor: User, userId: Uuid): User {
  if (!isAdministrator(actor)) throw forbidden(msg("errors.accounts.adminOnly"))
  const user = found(userOf(s, userId), "user")
  if (!user.personId) throw ruleViolation(msg("errors.accounts.notLinked"))
  user.personId = null
  user.ageCheck = null
  user.guardianConsentNote = null
  if (user.roles.length === 0) {
    user.approvedAt = null
    user.approvedBy = null
    user.registration = { as: "member", details: "", serviceId: null }
  }
  return user
}

/** Declines a registration: the account and everything the person entered are deleted. */
export function declineAccount(s: State, actor: User, userId: Uuid): User {
  const user = pendingAccount(s, actor, userId)
  s.users = s.users.filter((u) => u.id !== user.id)
  s.guardians = s.guardians.filter((g) => g.userId !== user.id)
  return user
}

/** The language a person reads the app (and its emails) in. */
export function setLanguage(s: State, actor: User, language: Language): User {
  const user = found(userOf(s, actor.id), "user")
  user.language = language
  return user
}
