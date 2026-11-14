import "server-only"

import { notFound } from "next/navigation"

import { fullName, initials, matchesQuery } from "@/lib/domain/names"
import type { Account, Uuid } from "@/lib/domain/types"
import { isAdministrator, isMember, isParent, isStaff } from "@/server/mock/access"
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
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accessSummary } from "./access"
import { accountName, personRef, unitRef } from "./present"

export type AccountStatus = "active" | "mustChange"
export type AccountFilter = "all" | "staff" | "parents" | "members"

export function statusOf(a: Account): AccountStatus {
  return a.mustChangePassword ? "mustChange" : "active"
}

/** Accounts, data requests and parental links are for administrators. */
function requireAdministrator(ctx: Context) {
  if (!isAdministrator(ctx.state, ctx.viewer)) {
    notFound()
  }
}

function kinds(s: State, account: Account) {
  return {
    staff: isStaff(s, account),
    parent: isParent(s, account),
    member: isMember(s, account),
  }
}

const FILTERS = ["all", "staff", "parents", "members"] as const

function inFilter(
  r: { kinds: { staff: boolean; parent: boolean; member: boolean } },
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
  requireAdministrator(ctx)
  const { state: s } = ctx
  const rows = s.accounts.map((a) => {
    const person = personOf(s, a.personId)!

    return {
      id: a.id,
      name: fullName(person),
      person,
      username: a.username,
      status: statusOf(a),
      kinds: kinds(s, a),
      access: accessSummary(ctx, a.id),
      lastSignInAt: a.lastSignInAt,
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
        access: r.access,
        lastSignInAt: r.lastSignInAt,
      })),
  }
}

/** People with an account, who can be linked to a parent as a child. */
export function childChoices(s: State) {
  return s.accounts
    .map((a) => {
      const p = personOf(s, a.personId)!

      return {
        ...personRef(p),
        username: a.username,
        groups: currentUnitsOfPerson(s, p.id, today()).map((u) => unitLabel(s, u)),
      }
    })
    .filter((c) => c.groups.length > 0)
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
  requireAdministrator(ctx)
  const { state: s } = ctx
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
    children: childChoices(s),
    existingNames: s.persons.map((p) => fullName(p).toLowerCase()),
    scopes: scopeChoices(s),
  }
}

export function getAccount(ctx: Context, accountId: Uuid) {
  requireAdministrator(ctx)
  const { state: s, viewer } = ctx
  const account = accountOf(s, accountId)

  if (!account) {
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
    kinds: kinds(s, account),
    createdAt: account.createdAt,
    createdBy: account.createdBy
      ? accountName(s, accountOf(s, account.createdBy) ?? account)
      : null,
    lastSignInAt: account.lastSignInAt,
    passwordChangedAt: account.passwordChangedAt,
    access: accessSummary(ctx, account.id),
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
    childChoices: childChoices(s).filter(
      (c) =>
        c.id !== person.id &&
        !s.guardianships.some((g) => g.accountId === account.id && g.childId === c.id)
    ),
    self: account.id === viewer.id,
    scopes: scopeChoices(s),
  }
}

export function getDataRequests(ctx: Context) {
  requireAdministrator(ctx)
  const { state: s } = ctx

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

  if (!request || !isAdministrator(s, viewer)) {
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
