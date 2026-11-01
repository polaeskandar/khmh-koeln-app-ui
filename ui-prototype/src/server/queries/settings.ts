import "server-only"

import { can, isParent, isStaff } from "@/lib/domain/policy"
import { CHURCH_TIME_ZONE } from "@/lib/domain/time"
import { today as clockToday } from "@/server/mock/clock"
import {
  currentGroupNames,
  currentStagesOf,
  personOf,
  stageOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context, Translator } from "@/server/viewer"

import { rolesOf, userRef, viewerInfo } from "./present"
import { getAssignableRoles, getRoleList } from "./roles"

function classOf(s: State, personId: string): string | null {
  const placement = currentStagesOf(s, personId, clockToday())[0]
  return placement ? (stageOf(s, placement.stageId)?.name ?? null) : null
}

/**
 * Parent access: requests waiting for approval and the approved links between parent accounts
 * and children.
 */
function parentAccess(s: State, t: Translator) {
  const links = s.guardians
    .filter((g) => g.status !== "revoked")
    .map((g) => {
      const parent = userOf(s, g.userId)
      const child = personOf(s, g.personId)
      return {
        id: g.id,
        status: g.status,
        parent: {
          id: g.userId,
          name: parent?.displayName ?? t("settings.unknownAccount"),
          email: parent?.email ?? "",
        },
        child: {
          id: g.personId,
          name: child
            ? `${child.displayName ?? child.firstName} ${child.lastName}`
            : t("settings.unknownPerson"),
          group: classOf(s, g.personId),
        },
        createdAt: g.createdAt,
        approvedAt: g.approvedAt,
        approvedBy: userRef(userOf(s, g.approvedBy))?.name ?? null,
      }
    })
  const children = s.persons
    .filter((p) => p.status === "active" && classOf(s, p.id) !== null)
    .map((p) => ({
      id: p.id,
      name: `${p.displayName ?? p.firstName} ${p.lastName}`,
      group: classOf(s, p.id)!,
    }))
    .sort((a, b) => a.group.localeCompare(b.group, "de") || a.name.localeCompare(b.name, "de"))
  const parents = s.users
    .filter((u) => !u.disabledAt && u.approvedAt !== null && isParent(u))
    .map((u) => ({ id: u.id, name: u.displayName, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
  return {
    pending: links
      .filter((l) => l.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    approved: links
      .filter((l) => l.status === "approved")
      .sort(
        (a, b) =>
          a.parent.name.localeCompare(b.parent.name, "de") ||
          a.child.name.localeCompare(b.child.name, "de")
      ),
    children,
    parents,
  }
}

/**
 * Member accounts: accounts linked to a member record that are not staff accounts (a servant's
 * record link is part of their staff account). Parents whose own record is linked are listed
 * too, since the link is what opens the member portal.
 */
function memberAccounts(s: State) {
  const today = clockToday()
  return s.users
    .filter((u) => u.personId !== null && !isStaff(u))
    .flatMap((u) => {
      const person = personOf(s, u.personId)
      if (!person) return []
      return [
        {
          id: u.id,
          name: u.displayName,
          email: u.email,
          disabled: u.disabledAt !== null,
          member: {
            id: person.id,
            name: `${person.firstName} ${person.lastName}`,
            groups: currentGroupNames(s, person.id, today),
            inactive: person.status !== "active",
          },
          isParent: isParent(u),
          ageCheck: u.ageCheck,
          guardianConsentNote: u.guardianConsentNote,
          approvedAt: u.approvedAt,
          approvedBy: userRef(userOf(s, u.approvedBy))?.name ?? null,
        },
      ]
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

export type MemberAccount = ReturnType<typeof memberAccounts>[number]

/**
 * The accounts in "Staff accounts and roles": approved accounts with roles, except parents whose
 * roles only open the parent portal (they are managed under parent access).
 */
function staffAccounts(ctx: Context) {
  const { state: s } = ctx
  return s.users
    .filter((u) => u.approvedAt !== null && u.roleIds.length > 0 && (isStaff(u) || !isParent(u)))
    .map((u) => ({
      ...userRef(u)!,
      email: u.email,
      disabled: u.disabledAt !== null,
      disabledAt: u.disabledAt,
      roles: rolesOf(s, u).map((r) => ({ id: r.id, name: r.name })),
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name, "de"))
}

export type StaffAccount = ReturnType<typeof staffAccounts>[number]

export async function getSettings(ctx: Context) {
  const { state: s, viewer } = ctx
  const seeAccounts = can(viewer, "read", "users")
  const canChangeAccounts = can(viewer, "update", "users")
  return {
    viewer: viewerInfo(ctx, viewer),
    users: seeAccounts ? staffAccounts(ctx) : null,
    parentAccess: seeAccounts ? parentAccess(s, ctx.t) : null,
    memberAccounts: seeAccounts ? memberAccounts(s) : null,
    roles: getRoleList(ctx),
    assignableRoles: canChangeAccounts ? getAssignableRoles(ctx) : [],
    canChangeAccounts,
    church: { name: "KHMK Köln", timeZone: CHURCH_TIME_ZONE },
    generatorRuns: [...s.generatorRuns].reverse().slice(0, 6),
    seededAt: s.seededAt,
    today: clockToday(),
    clock: process.env.KHMK_DEMO_CLOCK === "frozen" ? ("frozen" as const) : ("running" as const),
  }
}

export type SettingsPage = Awaited<ReturnType<typeof getSettings>>
