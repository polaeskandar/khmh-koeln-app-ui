import "server-only"

import { notFound } from "next/navigation"

import { fullName, initials, matchesQuery } from "@/lib/domain/names"
import { isPortalPermission, needsChurchScope, PERMISSIONS } from "@/lib/domain/policy"
import type { Account, Role, Scope, Uuid } from "@/lib/domain/types"
import { can, holdsChurchWide } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import { canGiveRole } from "@/server/mock/commands/access"
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

import { accountName, personRef, unitRef } from "./present"

export type AccountStatus = "active" | "mustChange"
export type AccountFilter = "all" | "staff" | "parents" | "members"

export function statusOf(a: Account): AccountStatus {
  return a.mustChangePassword ? "mustChange" : "active"
}

export function scopeLabel(s: State, scope: Scope): string | null {
  if (scope.type === "church") {
    return null
  }

  return unitLabel(s, {
    serviceId: scope.serviceId,
    stageId: scope.type === "stage" ? scope.stageId : null,
  })
}

function assignmentsOf(s: State, accountId: Uuid) {
  return s.assignments
    .filter((a) => a.accountId === accountId)
    .map((a) => {
      const role = s.roles.find((r) => r.id === a.roleId)!

      return {
        id: a.id,
        roleId: role.id,
        role: role.name,
        scope: a.scope,
        where: scopeLabel(s, a.scope),
      }
    })
}

function kinds(s: State, accountId: Uuid) {
  const permissions = s.assignments
    .filter((a) => a.accountId === accountId)
    .flatMap((a) => s.roles.find((r) => r.id === a.roleId)?.permissions ?? [])

  return {
    staff: permissions.some((p) => !p.startsWith("portal.")),
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

  if (!can(s, viewer, "accounts.manage")) {
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
      roles: assignmentsOf(s, a.id),
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

function roleChoice(s: State, viewer: Account, role: Role) {
  return {
    id: role.id,
    name: role.name,
    permissions: role.permissions,
    churchOnly: needsChurchScope(role.permissions),
    giveable: canGiveRole(s, viewer, role),
  }
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

  if (!can(s, viewer, "accounts.manage")) {
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
    roles: s.roles.map((r) => roleChoice(s, viewer, r)),
    scopes: scopeChoices(s),
    canLinkChildren: can(s, viewer, "guardians.manage"),
  }
}

export function getAccount(ctx: Context, accountId: Uuid) {
  const { state: s, viewer } = ctx
  const account = accountOf(s, accountId)

  if (!account || !can(s, viewer, "accounts.manage")) {
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
    roles: assignmentsOf(s, account.id),
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
      access: holdsChurchWide(s, viewer, "access.manage"),
      guardians: can(s, viewer, "guardians.manage"),
    },
    scopes: scopeChoices(s),
  }
}

export function getAccess(ctx: Context) {
  const { state: s, viewer } = ctx
  const canAccess = can(s, viewer, "access.manage")
  const canGuardians = can(s, viewer, "guardians.manage")

  if (!canAccess && !canGuardians) {
    notFound()
  }

  const parents = s.accounts
    .filter((a) => can(s, a, "portal.parent") || s.guardianships.some((g) => g.accountId === a.id))
    .map((a) => ({
      account: { id: a.id, name: accountName(s, a), username: a.username },
      children: s.guardianships
        .filter((g) => g.accountId === a.id)
        .map((g) => {
          const child = personOf(s, g.childId)!

          return {
            id: g.id,
            child: personRef(child),
            groups: currentUnitsOfPerson(s, child.id, today()).map((u) => unitLabel(s, u)),
            otherGuardians: s.guardianships
              .filter((x) => x.childId === child.id && x.accountId !== a.id)
              .map((x) => accountName(s, accountOf(s, x.accountId)!)),
          }
        }),
    }))
    .sort((a, b) => a.account.name.localeCompare(b.account.name, "de"))

  return {
    can: { access: canAccess, guardians: canGuardians },
    roles: s.roles.map((r) => ({
      ...roleChoice(s, viewer, r),
      protected: r.protected,
      holders: new Set(s.assignments.filter((a) => a.roleId === r.id).map((a) => a.accountId)).size,
    })),
    assignments: s.accounts
      .filter((a) => s.assignments.some((x) => x.accountId === a.id))
      .map((a) => ({
        account: { id: a.id, name: accountName(s, a), username: a.username },
        self: a.id === viewer.id,
        items: assignmentsOf(s, a.id).map((x) => {
          const role = s.roles.find((r) => r.id === x.roleId)!

          return {
            ...x,
            giveable: canGiveRole(s, viewer, role),
            portal: role.permissions.every(isPortalPermission),
          }
        }),
      }))
      .sort((a, b) => a.account.name.localeCompare(b.account.name, "de")),
    accounts: s.accounts
      .map((a) => ({ id: a.id, name: accountName(s, a), username: a.username }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    parentAccounts: s.accounts
      .filter((a) => can(s, a, "portal.parent"))
      .map((a) => ({ id: a.id, name: accountName(s, a), username: a.username }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    members: memberChoices(s),
    parents,
    scopes: scopeChoices(s),
  }
}

export function getRole(ctx: Context, roleId: Uuid | null) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "access.manage")) {
    notFound()
  }

  const role = roleId ? s.roles.find((r) => r.id === roleId) : undefined

  if (roleId && !role) {
    notFound()
  }

  return {
    role: role
      ? {
          id: role.id,
          name: role.name,
          permissions: role.permissions,
          protected: role.protected,
          holders: s.assignments
            .filter((a) => a.roleId === role.id)
            .map((a) => ({
              id: a.id,
              name: accountName(s, accountOf(s, a.accountId)!),
              where: scopeLabel(s, a.scope),
            })),
        }
      : null,
    catalog: PERMISSIONS,
  }
}

export function getDataRequests(ctx: Context) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "data.manage")) {
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

  if (!request || !can(s, viewer, "data.manage")) {
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
