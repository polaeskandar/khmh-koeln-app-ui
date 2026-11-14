import "server-only"

import {
  can,
  holdsAnywhere,
  isStaff,
  sessionsWith,
  unitsWith,
  visibleServices,
} from "@/server/mock/access"
import { now, today } from "@/server/mock/clock"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { opensAccess } from "./access"
import { viewerInfo } from "./present"

const PORTAL_PERSONAS = [
  "hoda.farag",
  "nadia.mansour",
  "nevine.boulos",
  "kirollos.ibrahim",
  "maria.hanna",
]

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
      accounts: can(s, viewer, "account.read"),
      access: opensAccess(s, viewer),
      data: can(s, viewer, "dataRequest.read"),
      services: visibleServices(s, viewer)
        .filter((x) => x.archivedAt === null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((x) => ({ id: x.id, name: x.name, tone: s.serviceTones[x.id] ?? 1 })),
      preparation:
        holdsAnywhere(s, viewer, "lesson.read") || holdsAnywhere(s, viewer, "lesson.create"),
      tasks: holdsAnywhere(s, viewer, "task.read"),
      attendance:
        unitsWith(s, viewer, "session.takeAttendance").length > 0 ||
        sessionsWith(s, viewer, "session.takeAttendance").length > 0,
    },
    staff: isStaff(s, viewer),
    now: now(),
    today: today(),
  }
}

export type Shell = Awaited<ReturnType<typeof getShell>>
