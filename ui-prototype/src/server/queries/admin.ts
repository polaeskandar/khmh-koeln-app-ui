import "server-only"

import { notFound } from "next/navigation"

import { fullName, initials, matchesQuery } from "@/lib/domain/names"
import { CHURCH, isPortalPermission, type ResourceRef } from "@/lib/domain/resources"
import type { Account, Uuid } from "@/lib/domain/types"
import { can, effectiveOf, heldBy } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import { erasureImpact } from "@/server/mock/commands/privacy"
import {
  accountOf,
  childrenOf,
  currentUnitsOfPerson,
  isCurrentOn,
  personOf,
  stagesOf,
  unitLabel,
} from "@/server/mock/selectors"
import { resourcesUnder } from "@/server/mock/resources"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName, personRef, unitRef } from "./present"
import { assignmentsOf, opensAccess, roleOptions } from "./access"

export type AccountStatus = "active" | "mustChange"
export type AccountFilter = "all" | "staff" | "parents" | "members"

export function statusOf(a: Account): AccountStatus {
  return a.mustChangePassword ? "mustChange" : "active"
}

/** Where onboarding may give first roles: the whole church, and each service and stage. */
function onboardingScopes(s: State): ResourceRef[] {
  const date = today()
  const services = resourcesUnder(s, CHURCH, "service", date)

  return [CHURCH, ...services.flatMap((svc) => [svc, ...resourcesUnder(s, svc, "stage", date)])]
}

function kinds(s: State, accountId: Uuid) {
  const permissions = heldBy(s, accountId).flatMap((h) => [...effectiveOf(s, h.role.id)])

  return {
    staff: permissions.some((p) => !isPortalPermission(p)),
    parent: permissions.includes("portal.parent"),
    member: permissions.includes("portal.member"),
  }
}

const FILTERS = ["all", "staff", "parents", "members"] as const

function inFilter(
  r: { status: AccountStatus; kinds: { staff: boolean; parent: boolean; member: boolean } },
  filter: AccountFilter
): boolean {
  switch (filter) {
    case "staff":
      return r.kinds.staff
    case "parents":
      return r.kinds.parent
    case "members":
      return r.kinds.member
    default:
      return true
  }
}

export function getAccounts(ctx: Context, query: string, filter: AccountFilter) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "account.read")) {
    notFound()
  }

  const rows = s.accounts.map((a) => {
    const person = personOf(s, a.personId)!

    return {
      id: a.id,
      name: fullName(person),
      person,
      username: a.username,
      status: statusOf(a),
      kinds: kinds(s, a.id),
      roles: assignmentsOf(ctx, a.id),
      lastSignInAt: a.lastSignInAt,
      createdAt: a.createdAt,
    }
  })
  const matches = (r: (typeof rows)[number]) =>
    query.trim() === "" ||
    matchesQuery(r.person, query) ||
    r.username.includes(query.trim().toLowerCase())
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, rows.filter((r) => inFilter(r, f)).length])
  ) as Record<AccountFilter, number>

  return {
    counts,
    rows: rows
      .filter((r) => matches(r) && inFilter(r, filter))
      .sort(
        (a, b) =>
          Number(b.status === "mustChange") - Number(a.status === "mustChange") ||
          Number(b.kinds.staff) - Number(a.kinds.staff) ||
          a.name.localeCompare(b.name, "de")
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        initials: initials(r.person),
        username: r.username,
        status: r.status,
        kinds: r.kinds,
        roles: r.roles,
        lastSignInAt: r.lastSignInAt,
      })),
  }
}

export function memberChoices(s: State) {
  return s.accounts
    .filter((a) => can(s, a, "portal.member"))
    .map((a) => {
      const p = personOf(s, a.personId)!

      return {
        ...personRef(p),
        username: a.username,
        groups: currentUnitsOfPerson(s, p.id, today()).map((u) => unitLabel(s, u)),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

export function scopeChoices(s: State) {
  return s.services
    .filter((x) => x.archivedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({
      serviceId: x.id,
      name: x.name,
      structure: x.structure,
      stages: stagesOf(s, x.id).map((st) => ({ id: st.id, name: st.name })),
    }))
}

export function getAccountForm(ctx: Context) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "account.create")) {
    notFound()
  }

  const withAccount = new Set(s.accounts.map((a) => a.personId))
  const date = today()

  return {
    people: s.persons
      .filter((p) => !withAccount.has(p.id))
      .map((p) => ({
        ...personRef(p),
        firstName: p.firstName,
        groups: currentUnitsOfPerson(s, p.id, date).map((u) => unitLabel(s, u)),
      })),
    members: memberChoices(s),
    existingNames: s.persons.map((p) => fullName(p).toLowerCase()),
    roles: roleOptions(ctx, onboardingScopes(s)),
    scopes: scopeChoices(s),
    canLinkChildren: can(s, viewer, "guardianship.create"),
  }
}

export function getAccount(ctx: Context, accountId: Uuid) {
  const { state: s, viewer } = ctx
  const account = accountOf(s, accountId)

  if (!account || !can(s, viewer, "account.read")) {
    notFound()
  }

  const person = personOf(s, account.personId)!
  const date = today()

  return {
    id: account.id,
    name: fullName(person),
    person: personRef(person),
    username: account.username,
    status: statusOf(account),
    kinds: kinds(s, account.id),
    createdAt: account.createdAt,
    createdBy: account.createdBy
      ? accountName(s, accountOf(s, account.createdBy) ?? account)
      : null,
    lastSignInAt: account.lastSignInAt,
    passwordChangedAt: account.passwordChangedAt,
    roles: assignmentsOf(ctx, account.id),
    groups: s.memberships
      .filter((m) => m.personId === person.id && isCurrentOn(m, date))
      .map((m) => ({ id: m.id, unit: unitRef(s, m) })),
    children: s.guardianships
      .filter((g) => g.accountId === account.id)
      .map((g) => {
        const child = personOf(s, g.childId)!

        return {
          id: g.id,
          child: personRef(child),
          groups: currentUnitsOfPerson(s, child.id, date).map((u) => unitLabel(s, u)),
        }
      }),
    self: account.id === viewer.id,
    can: {
      guardians: can(s, viewer, "guardianship.create"),
      access: opensAccess(s, viewer),
    },
    scopes: scopeChoices(s),
  }
}

export function getParentalAccess(ctx: Context) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "guardianship.read")) {
    notFound()
  }

  const date = today()

  return {
    canLink: can(s, viewer, "guardianship.create"),
    canUnlink: can(s, viewer, "guardianship.delete"),
    parentAccounts: s.accounts
      .filter((a) => can(s, a, "portal.parent"))
      .map((a) => ({ id: a.id, name: accountName(s, a), username: a.username }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    members: memberChoices(s),
    parents: s.accounts
      .filter(
        (a) => can(s, a, "portal.parent") || s.guardianships.some((g) => g.accountId === a.id)
      )
      .map((a) => ({
        account: { id: a.id, name: accountName(s, a), username: a.username },
        initials: initials(personOf(s, a.personId)!),
        children: s.guardianships
          .filter((g) => g.accountId === a.id)
          .map((g) => {
            const child = personOf(s, g.childId)!

            return {
              id: g.id,
              child: personRef(child),
              groups: currentUnitsOfPerson(s, child.id, date).map((u) => unitLabel(s, u)),
              otherGuardians: s.guardianships
                .filter((x) => x.childId === child.id && x.accountId !== a.id)
                .map((x) => accountName(s, accountOf(s, x.accountId)!)),
            }
          }),
      }))
      .sort((a, b) => a.account.name.localeCompare(b.account.name, "de")),
  }
}

export function getDataRequests(ctx: Context) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "dataRequest.read")) {
    notFound()
  }

  const rows = [...s.dataRequests].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return {
    today: today(),
    open: rows.filter((r) => r.status === "open"),
    closed: rows.filter((r) => r.status !== "open"),
    people: s.persons
      .map((p) => ({
        id: p.id,
        name: fullName(p),
        groups: currentUnitsOfPerson(s, p.id, today()).map((u) => unitLabel(s, u)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }
}

export function getDataRequest(ctx: Context, requestId: Uuid) {
  const { state: s, viewer } = ctx
  const request = s.dataRequests.find((r) => r.id === requestId)

  if (!request || !can(s, viewer, "dataRequest.read")) {
    notFound()
  }

  const person = request.personId ? personOf(s, request.personId) : undefined
  const subjectAccount = person ? s.accounts.find((a) => a.personId === person.id) : undefined

  return {
    request,
    today: today(),
    closedBy: request.closedBy ? accountName(s, accountOf(s, request.closedBy) ?? viewer) : null,
    subject: person
      ? {
          id: person.id,
          name: fullName(person),
          groups: currentUnitsOfPerson(s, person.id, today()).map((u) => unitLabel(s, u)),
          children: subjectAccount ? childrenOf(s, subjectAccount.id).map((c) => fullName(c)) : [],
          hasAccount: subjectAccount !== undefined,
        }
      : null,
    impact: person ? erasureImpact(s, person.id) : null,
    self: subjectAccount?.id === viewer.id,
  }
}
