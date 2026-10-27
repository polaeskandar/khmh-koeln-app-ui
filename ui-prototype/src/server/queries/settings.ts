import "server-only"

import { can } from "@/lib/domain/policy"
import { CHURCH_TIME_ZONE } from "@/lib/domain/time"
import { today as clockToday } from "@/server/mock/clock"
import {
  currentStagesOf,
  isArchived,
  personOf,
  serviceOf,
  stageOf,
  stagesOf,
  userOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context, Translator } from "@/server/viewer"

import { serviceRef, stageRef, userRef, viewerInfo } from "./present"

function classOf(s: State, personId: string): string | null {
  const placement = currentStagesOf(s, personId, clockToday())[0]
  return placement ? (stageOf(s, placement.stageId)?.name ?? null) : null
}

/**
 * Parent access, for administrators only: requests waiting for approval and
 * the approved links between parent accounts and children.
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
    .filter((u) => !u.disabledAt && u.roles.some((r) => r.role === "parent"))
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

export async function getSettings(ctx: Context) {
  const { state: s, viewer } = ctx
  const canManageUsers = can(viewer, "MANAGE_USERS")
  const users = s.users
    // Parent accounts are managed under parent access; the list here is the church's staff.
    .filter((u) => u.roles.some((r) => r.role !== "parent"))
    .map((u) => ({
      ...userRef(u)!,
      email: u.email,
      disabled: u.disabledAt !== null,
      disabledAt: u.disabledAt,
      roles: u.roles
        .filter((r) => r.role !== "parent")
        .map((r) => ({
          role: r.role,
          service: r.serviceId ? serviceRef(s, serviceOf(s, r.serviceId)!) : null,
          stage: stageRef(stageOf(s, r.stageId)),
        })),
      isParentToo: u.roles.some((r) => r.role === "parent"),
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name, "de"))
  return {
    viewer: viewerInfo(ctx, viewer),
    users,
    services: s.services
      .filter((x) => !isArchived(x))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((x) => ({ ...serviceRef(s, x), stages: stagesOf(s, x.id).map((st) => stageRef(st)!) })),
    parentAccess: canManageUsers ? parentAccess(s, ctx.t) : null,
    church: { name: "KHMK Köln", timeZone: CHURCH_TIME_ZONE },
    generatorRuns: [...s.generatorRuns].reverse().slice(0, 6),
    seededAt: s.seededAt,
    today: clockToday(),
    clock: process.env.KHMK_DEMO_CLOCK === "frozen" ? ("frozen" as const) : ("running" as const),
    canManageUsers,
  }
}

export type SettingsPage = Awaited<ReturnType<typeof getSettings>>
