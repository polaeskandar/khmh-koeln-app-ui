import "server-only"

import { getLocale, getTranslations } from "next-intl/server"

import { can, isActiveAccount, isStaff } from "@/lib/domain/policy"
import { formatFor } from "@/lib/format"
import { today as clockToday } from "@/server/mock/clock"
import { currentStagesOf, isArchived, serviceOf, stageOf, stagesOf } from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import { openState } from "@/server/mock/runtime"
import type { Context } from "@/server/viewer"

import { serviceRef, stageRef, viewerInfo } from "./present"

/** Active services, with their stages, for choosing where someone serves. */
function servicesWithStages(s: State) {
  return s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => ({ ...serviceRef(s, x), stages: stagesOf(s, x.id).map((st) => stageRef(st)!) }))
}

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
 * Accounts people registered themselves, waiting for an administrator. Only
 * administrators see them; for everyone else this is null.
 */
export async function getAccountRequests(ctx: Context) {
  const { state: s, viewer } = ctx
  if (!can(viewer, "MANAGE_USERS")) return null
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
    services: servicesWithStages(s),
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
    .sort(
      (a, b) =>
        Number(b.isAdmin) - Number(a.isAdmin) ||
        Number(b.isStaff) - Number(a.isStaff) ||
        a.name.localeCompare(b.name, "de")
    )
}
