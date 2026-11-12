import "server-only"

import { can, isStaff, unitsWith, visibleServices } from "@/server/mock/access"
import { now, today } from "@/server/mock/clock"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { viewerInfo } from "./present"

const PORTAL_PERSONAS = ["hoda.farag", "nadia.mansour", "nevine.boulos", "kirollos.ibrahim"]

export function personasOf(s: State) {
  return s.accounts
    .filter(
      (a) => isStaff(s, a) || PORTAL_PERSONAS.includes(a.username) || a.createdAt > s.seededAt
    )
    .map((a) => viewerInfo(s, a))
}

export async function getShell(ctx: Context) {
  const { state: s, viewer } = ctx

  return {
    viewer: viewerInfo(s, viewer),
    personas: personasOf(s),
    nav: {
      accounts: can(s, viewer, "accounts.manage"),
      access: can(s, viewer, "access.manage") || can(s, viewer, "guardians.manage"),
      data: can(s, viewer, "data.manage"),
      services: visibleServices(s, viewer)
        .filter((x) => x.archivedAt === null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((x) => ({ id: x.id, name: x.name, tone: s.serviceTones[x.id] ?? 1 })),
      preparation: unitsWith(s, viewer, "lessons.prepare").length > 0,
      tasks: unitsWith(s, viewer, "tasks.manage").length > 0,
      attendance: unitsWith(s, viewer, "attendance.record").length > 0,
    },
    staff: isStaff(s, viewer),
    now: now(),
    today: today(),
  }
}

export type Shell = Awaited<ReturnType<typeof getShell>>
