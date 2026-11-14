import { msg } from "@/i18n/message"
import { cleanName, fullName } from "@/lib/domain/names"
import type { Account, Person, Unit, Uuid } from "@/lib/domain/types"
import { normalizeUsername, PASSWORD_MIN, usernameProblem } from "@/lib/domain/username"
import { forbidden, ruleViolation } from "@/server/errors"

import { isAdministrator } from "../access"
import { now, nowMs, today } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { hashPassword, verifyPassword } from "../passwords"
import { accountOf, personOf } from "../selectors"
import type { State } from "../state"

import { ensureAdministratorRemains } from "./access"

export type Actor = { state: State; viewer: Account }

/** Accounts are an administrative responsibility, separate from giving access to resources. */
function administrator(s: State, viewer: Account) {
  if (!isAdministrator(s, viewer)) {
    throw forbidden()
  }
}

export type SignInResult = { ok: true; account: Account } | { ok: false }

export function authenticate(s: State, username: string, password: string): SignInResult {
  const key = normalizeUsername(username)
  const account = s.accounts.find((a) => a.username === key)
  const valid = verifyPassword(password, account?.passwordHash ?? null)

  if (!account || !valid) {
    return { ok: false }
  }

  account.lastSignInAt = now()

  return { ok: true, account }
}

function checkUsername(s: State, v: Violations, value: string, except: Uuid | null): string {
  const username = normalizeUsername(value)
  const problem = usernameProblem(username)

  if (problem) {
    v.add("username", msg(`errors.username.${problem}`))
  } else if (s.accounts.some((a) => a.username === username && a.id !== except)) {
    v.add("username", msg("errors.username.taken"))
  }

  return username
}

function checkNewPassword(v: Violations, field: string, password: string) {
  if (password.length < PASSWORD_MIN) {
    v.add(field, msg("errors.password.tooShort", { min: PASSWORD_MIN }))
  } else if (password.length > 200) {
    v.add(field, msg("errors.validation.tooLong", { max: 200 }))
  }
}

export function changeOwnPassword(
  s: State,
  account: Account,
  current: string,
  next: string,
  confirmation: string
): void {
  const v = new Violations()

  if (!verifyPassword(current, account.passwordHash)) {
    v.add("current", msg("errors.password.currentWrong"))
  }

  checkNewPassword(v, "next", next)

  if (!v.has("next") && next === current) {
    v.add("next", msg("errors.password.sameAsBefore"))
  }

  if (!v.has("next") && next !== confirmation) {
    v.add("confirmation", msg("errors.password.mismatch"))
  }

  v.throwIfAny()
  account.passwordHash = hashPassword(next)
  account.mustChangePassword = false
  account.passwordChangedAt = now()
}

export type NewAccountInput = {
  personId: Uuid | null
  firstName: string
  lastName: string
  username: string
  temporaryPassword: string
  groups: Unit[]
  childIds: Uuid[]
}

export function createAccount({ state: s, viewer }: Actor, input: NewAccountInput) {
  administrator(s, viewer)
  const v = new Violations()
  let person: Person | undefined

  if (input.personId) {
    person = found(personOf(s, input.personId), "person")

    if (s.accounts.some((a) => a.personId === person!.id)) {
      v.add("personId", msg("errors.accounts.personHasAccount"))
    }
  } else {
    v.name("firstName", input.firstName, 80, msg("errors.validation.firstNameRequired"))
    v.name("lastName", input.lastName, 80, msg("errors.validation.lastNameRequired"))
  }

  const username = checkUsername(s, v, input.username, null)
  checkNewPassword(v, "temporaryPassword", input.temporaryPassword)

  v.throwIfAny()
  const time = now()

  if (!person) {
    person = {
      id: uuidv7(nowMs()),
      firstName: cleanName(input.firstName),
      lastName: cleanName(input.lastName),
      displayName: null,
      createdAt: time,
    }
    s.persons.push(person)
  }

  const account: Account = {
    id: uuidv7(nowMs()),
    personId: person.id,
    username,
    passwordHash: hashPassword(input.temporaryPassword),
    mustChangePassword: true,
    passwordChangedAt: null,
    language: null,
    lastSignInAt: null,
    createdAt: time,
    createdBy: viewer.id,
  }
  s.accounts.push(account)

  for (const group of input.groups) {
    addGroup(s, person.id, group)
  }

  for (const childId of input.childIds) {
    found(personOf(s, childId), "person")
    s.guardianships.push({
      id: uuidv7(nowMs()),
      accountId: account.id,
      childId,
      createdAt: time,
      createdBy: viewer.id,
    })
  }

  return { id: account.id, username, name: fullName(person) }
}

export function addGroup(s: State, personId: Uuid, unit: Unit) {
  const exists = s.memberships.some(
    (m) =>
      m.personId === personId &&
      m.serviceId === unit.serviceId &&
      m.stageId === unit.stageId &&
      m.endsOn === null
  )

  if (!exists) {
    s.memberships.push({
      id: uuidv7(nowMs()),
      personId,
      serviceId: unit.serviceId,
      stageId: unit.stageId,
      startsOn: today(),
      endsOn: null,
    })
  }
}

/** An account an administrator may change: any but their own (that is done in Settings). */
function managedAccount({ state: s, viewer }: Actor, accountId: Uuid): Account {
  administrator(s, viewer)
  const account = found(accountOf(s, accountId), "account")

  if (account.id === viewer.id) {
    throw ruleViolation(msg("errors.accounts.notYourOwn"))
  }

  return account
}

export function resetPassword(actor: Actor, accountId: Uuid, temporaryPassword: string) {
  const account = managedAccount(actor, accountId)
  const v = new Violations()
  checkNewPassword(v, "temporaryPassword", temporaryPassword)
  v.throwIfAny()
  account.passwordHash = hashPassword(temporaryPassword)
  account.mustChangePassword = true
  account.passwordChangedAt = null

  return { username: account.username }
}

export function changeUsername(actor: Actor, accountId: Uuid, value: string) {
  administrator(actor.state, actor.viewer)
  const account = found(accountOf(actor.state, accountId), "account")
  const v = new Violations()
  const username = checkUsername(actor.state, v, value, account.id)
  v.throwIfAny()
  account.username = username

  return { username }
}

export function forgetAccount(s: State, accountId: Uuid) {
  const clear = (id: Uuid | null) => (id === accountId ? null : id)
  s.grants = s.grants.filter((g) => g.accountId !== accountId)
  s.managers = s.managers.filter((m) => m.accountId !== accountId)
  s.guardianships = s.guardianships.filter((g) => g.accountId !== accountId)
  s.accounts = s.accounts.filter((a) => a.id !== accountId)
  s.attendance.forEach((a) => {
    a.recordedBy = clear(a.recordedBy)
    a.removedBy = clear(a.removedBy)
  })
  s.sessions.forEach((x) => {
    x.closedBy = clear(x.closedBy)
  })
  s.lessons.forEach((l) => {
    l.responsibleId = clear(l.responsibleId)
  })
  s.tasks.forEach((t) => {
    t.createdBy = clear(t.createdBy)
  })
  s.completions.forEach((c) => {
    c.completedBy = clear(c.completedBy)
  })
  s.plans.forEach((p) => {
    p.updatedBy = clear(p.updatedBy)
    p.confirmedBy = clear(p.confirmedBy)
  })
  s.accounts.forEach((a) => {
    a.createdBy = clear(a.createdBy)
  })
  s.grants.forEach((g) => {
    g.createdBy = clear(g.createdBy)
  })
  s.managers.forEach((m) => {
    m.createdBy = clear(m.createdBy)
  })
  s.guardianships.forEach((g) => {
    g.createdBy = clear(g.createdBy)
  })
  s.dataRequests.forEach((r) => {
    r.closedBy = clear(r.closedBy)
  })
  s.occasions.forEach((o) => {
    o.verifiedBy = clear(o.verifiedBy)
  })
}

export function deleteAccount(actor: Actor, accountId: Uuid) {
  const account = managedAccount(actor, accountId)
  ensureAdministratorRemains(actor.state, { removedAccountId: account.id })
  forgetAccount(actor.state, account.id)
}

export function addAccountGroup({ state: s, viewer }: Actor, accountId: Uuid, unit: Unit) {
  administrator(s, viewer)
  const account = found(accountOf(s, accountId), "account")
  addGroup(s, account.personId, unit)
}

export function endAccountGroup({ state: s, viewer }: Actor, membershipId: Uuid) {
  administrator(s, viewer)
  const membership = found(
    s.memberships.find((m) => m.id === membershipId),
    "person"
  )

  if (membership.startsOn === today()) {
    s.memberships.splice(s.memberships.indexOf(membership), 1)

    return
  }

  membership.endsOn = today()
}
