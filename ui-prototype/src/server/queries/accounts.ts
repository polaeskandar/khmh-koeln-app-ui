import "server-only"

import { getLocale, getTranslations } from "next-intl/server"

import { can, isActiveAccount, isStaff } from "@/lib/domain/policy"
import { formatFor } from "@/lib/format"
import type { ViewerInfo } from "@/lib/view-models"
import { today as clockToday } from "@/server/mock/clock"
import {
  currentGroupNames,
  currentStagesOf,
  isArchived,
  serviceOf,
  stageOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import { openState } from "@/server/mock/runtime"
import type { Context } from "@/server/viewer"

import { serviceRef, viewerInfo } from "./present"
import { getAssignableRoles } from "./roles"

/** Children in a stage today, for linking them to a parent account. */
function linkableChildren(s: State) {
  const today = clockToday()
  return s.persons
    .filter((p) => p.status === "active")
    .flatMap((p) => {
      const placement = currentStagesOf(s, p.id, today)[0]
      const stage = placement ? stageOf(s, placement.stageId) : undefined
      return stage ? [{ id: p.id, name: `${p.firstName} ${p.lastName}`, group: stage.name }] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

/**
 * Member records an account can be linked to: active people with the groups they are in today,
 * and whether a record already has an account (a record belongs to at most one account).
 */
function linkableMembers(s: State) {
  const today = clockToday()
  const linked = new Set(s.users.map((u) => u.personId).filter(Boolean))
  return s.persons
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      displayName: p.displayName,
      groups: currentGroupNames(s, p.id, today),
      hasAccount: linked.has(p.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
}

/**
 * Accounts people registered themselves, waiting for the office. Accounts that may see accounts
 * get the list; approving and declining needs "Accounts: Add". Null for everyone else.
 */
export async function getAccountRequests(ctx: Context) {
  const { state: s, viewer } = ctx
  if (!can(viewer, "read", "users")) return null
  const requests = s.users
    .filter((u) => u.approvedAt === null && u.disabledAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((u) => ({
      id: u.id,
      name: u.displayName,
      email: u.email,
      language: u.language,
      registeredAt: u.createdAt,
      as: u.registration?.as ?? ("parent" as const),
      details: u.registration?.details ?? "",
      service: u.registration?.serviceId
        ? (() => {
            const service = serviceOf(s, u.registration.serviceId)
            return service ? serviceRef(s, service) : null
          })()
        : null,
    }))
  return {
    requests,
    children: linkableChildren(s),
    members: linkableMembers(s),
    // Approving a parent or a servant gives the account its roles.
    roles: getAssignableRoles(ctx),
    canDecide: can(viewer, "create", "users"),
    today: clockToday(),
  }
}

export type AccountRequests = NonNullable<Awaited<ReturnType<typeof getAccountRequests>>>

/** For the registration form: the services someone can say they serve in. */
export function getRegistrationServices() {
  const s = openState()
  return s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => ({ id: x.id, name: x.name }))
}

/** Accounts that can change roles first, then staff, then by name. */
export function byAccess(a: ViewerInfo, b: ViewerInfo) {
  return (
    Number(b.permissions.includes("roles:update")) -
      Number(a.permissions.includes("roles:update")) ||
    Number(b.isStaff) - Number(a.isStaff) ||
    a.name.localeCompare(b.name, "de")
  )
}

/**
 * The prototype's quick sign-in: every active staff account and the parents
 * of the demo story. Public, like the sign-in page.
 */
export async function getDemoAccounts() {
  const s = openState()
  const [t, locale] = await Promise.all([getTranslations(), getLocale()])
  const f = formatFor(locale)
  return s.users
    .filter((u) => isActiveAccount(u) && (isStaff(u) || u.personId !== null))
    .map((u) => viewerInfo({ state: s, viewer: u, t, f }, u))
    .sort(byAccess)
}
