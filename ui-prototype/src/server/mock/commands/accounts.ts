import "server-only"

import { randomBytes } from "node:crypto"

import { msg } from "@/i18n/message"
import { permissionsOf } from "@/lib/domain/policy"
import { PRIVACY_VERSION } from "@/lib/domain/privacy"
import { epochOf, toInstant } from "@/lib/domain/time"
import type { AgeCheck, GuardianRelationship, Language, User, Uuid } from "@/lib/domain/types"
import { ruleViolation } from "@/server/errors"

import { nowMs } from "../clock"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../passwords"
import { isArchived, personOf, roleOf, serviceOf, userOf } from "../selectors"
import type { State } from "../state"
import { addAssignments, type AssignmentInput, checkedGroups } from "./assignments"

/**
 * Accounts: registration, sign-in and the administrator's approval.
 *
 * Anyone can register. The office sees a registration only once the person has
 * opened the link sent to the address (backend #84), and the account can't be
 * used until the office approves it: for a parent by linking their children and
 * giving roles (Parent), for a servant by giving roles, for a member by linking
 * the account to their own member record (under 16 only with a parent's or
 * guardian's agreement).
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

/** A registration whose address nobody has confirmed yet. The office doesn't see it. */
export const isUnconfirmed = (u: User) => u.approvedAt === null && u.emailConfirmedAt === null

/** How long a confirmation link works. Registering again sends a new one. */
const CONFIRMATION_LINK_DAYS = 7

/**
 * Makes the link the registration email holds: a token of 32 random bytes in base64url, like the
 * backend's. It replaces the older link, which then no longer works.
 */
function newConfirmationLink(user: User) {
  user.emailConfirmation = {
    token: randomBytes(32).toString("base64url"),
    expiresAt: toInstant(nowMs() + CONFIRMATION_LINK_DAYS * 86_400_000),
  }
}

/**
 * Registers an account with an unconfirmed address and sends the link to confirm it. Registering
 * again with an address that is still unconfirmed changes nothing but the link.
 */
export function register(s: State, input: RegistrationInput): User {
  const v = new Violations()
  const first = v.name("firstName", input.firstName, 80, msg("errors.accounts.firstNameRequired"))
  const last = v.name("lastName", input.lastName, 80, msg("errors.accounts.lastNameRequired"))
  const email = normalizeEmail(input.email)
  const existing = accountByEmail(s, email)
  if (email === "") v.add("email", msg("errors.accounts.emailRequired"))
  else if (!EMAIL.test(email) || email.length > 180)
    v.add("email", msg("errors.accounts.emailInvalid"))
  else if (existing && !isUnconfirmed(existing)) v.add("email", msg("errors.accounts.emailTaken"))
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

  // Hashed either way, so the answer takes as long whether or not the address has an account.
  const passwordHash = hashPassword(input.password)
  if (existing) {
    newConfirmationLink(existing)
    return existing
  }
  const ms = nowMs()
  const user: User = {
    id: uuidv7(ms),
    email,
    displayName: `${first} ${last}`,
    personId: null,
    roleIds: [],
    permissions: [],
    passwordHash,
    language: input.language,
    registration: { as: input.as, details, serviceId },
    emailConfirmedAt: null,
    emailConfirmation: null,
    privacyAcceptedAt: toInstant(ms),
    privacyVersion: PRIVACY_VERSION,
    approvedAt: null,
    approvedBy: null,
    ageCheck: null,
    guardianConsentNote: null,
    disabledAt: null,
    createdAt: toInstant(ms),
  }
  newConfirmationLink(user)
  s.users.push(user)
  return user
}

/**
 * Confirms a registration's address with the token of its link: the office now sees the
 * registration. False for an unknown, used, voided or expired link, which the page can't tell apart.
 */
export function confirmEmail(s: State, token: string): boolean {
  const ms = nowMs()
  const user = s.users.find((u) => u.emailConfirmation?.token === token)
  if (!user?.emailConfirmation || epochOf(user.emailConfirmation.expiresAt) <= ms) return false
  user.emailConfirmedAt = toInstant(ms)
  user.emailConfirmation = null
  return true
}

export type SignInResult =
  | { ok: true; user: User }
  /** wrong: unknown email or wrong password (never says which); the others only after a correct password. */
  | { ok: false; reason: "wrong" | "unconfirmed" | "pending" | "disabled" }

export function authenticate(s: State, email: string, password: string): SignInResult {
  const user = accountByEmail(s, email)
  if (!verifyPassword(password, user?.passwordHash ?? null) || !user) {
    return { ok: false, reason: "wrong" }
  }
  if (user.disabledAt) return { ok: false, reason: "disabled" }
  if (isUnconfirmed(user)) return { ok: false, reason: "unconfirmed" }
  if (!user.approvedAt) return { ok: false, reason: "pending" }
  return { ok: true, user }
}

export type ApprovalInput =
  | {
      as: "parent"
      childIds: Uuid[]
      /** The roles the account gets; the dialog suggests those that open the parent portal. */
      roleIds: Uuid[]
    }
  | {
      as: "servant"
      /** The roles the account gets. */
      roleIds: Uuid[]
      /**
       * Where they serve: services or stages, created with the approval. Roles for assigned
       * groups hold only there.
       */
      assignments?: AssignmentInput[]
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
  authorize(actor, "create", "users", msg("errors.accounts.adminOnly"))
  const user = found(userOf(s, userId), "user")
  if (user.approvedAt) throw ruleViolation(msg("errors.accounts.alreadyApproved"))
  return user
}

/** The roles chosen for an approval: at least one, and each must exist. */
function chosenRoles(s: State, v: Violations, roleIds: Uuid[]): Uuid[] {
  const ids = [...new Set(roleIds)]
  if (ids.length === 0) v.add("roleIds", msg("errors.roles.chooseRole"))
  else if (ids.some((id) => !roleOf(s, id))) v.add("roleIds", msg("errors.roles.unknown"))
  return ids
}

/**
 * Approves a registration: links the children, gives the roles (and, for a servant, the groups
 * they serve in) or links the member record, then the account can be used.
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
    user.roleIds = []
    user.personId = person!.id
    user.ageCheck = input.ageCheck
    user.guardianConsentNote = input.ageCheck === "guardianConsent" && note ? note : null
  } else if (input.as === "parent") {
    const children = [...new Set(input.childIds)].map((id) => personOf(s, id))
    if (children.length === 0) v.add("childIds", msg("errors.accounts.chooseChild"))
    if (children.some((c) => !c || c.status !== "active")) {
      v.add("childIds", msg("errors.accounts.childNotFound"))
    }
    const roleIds = chosenRoles(s, v, input.roleIds)
    v.throwIfAny()
    user.roleIds = roleIds
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
    const roleIds = chosenRoles(s, v, input.roleIds)
    v.throwIfAny()
    const groups = checkedGroups(s, actor, input.assignments ?? [])
    user.roleIds = roleIds
    addAssignments(s, user, groups, ms)
  }
  user.permissions = permissionsOf(s.roles, user.roleIds)
  user.approvedAt = toInstant(ms)
  user.approvedBy = actor.id
  // The registration text was only needed for this decision.
  user.registration = null
  return user
}

/**
 * Removes the link between an account and its member record, for example when the office linked
 * the wrong person. Reports the account made stay in the history. An account with roles (a
 * parent) keeps them; an account that only had the link goes back to the account requests, so
 * the office links it to the right record or declines it.
 */
export function unlinkMember(s: State, actor: User, userId: Uuid): User {
  authorize(actor, "update", "users", msg("errors.accounts.unlinkNotAllowed"))
  const user = found(userOf(s, userId), "user")
  if (!user.personId) throw ruleViolation(msg("errors.accounts.notLinked"))
  user.personId = null
  user.ageCheck = null
  user.guardianConsentNote = null
  if (user.roleIds.length === 0) {
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
