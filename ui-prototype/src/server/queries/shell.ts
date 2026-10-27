import "server-only"

import { can, isActiveAccount, isStaff } from "@/lib/domain/policy"
import { localDateOf } from "@/lib/domain/time"
import { nowMs, now } from "@/server/mock/clock"
import type { Context } from "@/server/viewer"

import { viewerInfo } from "./present"

export async function getShell(ctx: Context) {
  const { state, viewer } = ctx
  const today = localDateOf(nowMs())
  const openSessions = state.sessions.filter(
    (x) => x.status === "active" && can(viewer, "RECORD_ATTENDANCE", x.serviceId, x.stageId)
  ).length
  // The prototype's "view as" list: every staff account and the parents with a profile in the
  // demo story. The other parent accounts exist in the data but are not listed, to keep it short.
  const personas = state.users
    .filter((u) => isActiveAccount(u) && (isStaff(u) || u.personId !== null))
    .map((u) => viewerInfo(ctx, u))
    .sort(
      (a, b) =>
        Number(b.isAdmin) - Number(a.isAdmin) ||
        Number(b.isStaff) - Number(a.isStaff) ||
        a.name.localeCompare(b.name, "de")
    )
  return {
    viewer: viewerInfo(ctx, viewer),
    personas,
    openSessions,
    now: now(),
    today,
  }
}

export type Shell = Awaited<ReturnType<typeof getShell>>
