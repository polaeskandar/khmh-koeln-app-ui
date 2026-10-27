import "server-only"

import { can } from "@/lib/domain/policy"
import { daysUntil } from "@/lib/domain/privacy"
import type { DataRequest } from "@/lib/domain/types"
import { today as clockToday } from "@/server/mock/clock"
import { inventoryOf, ownOpenErasure } from "@/server/mock/commands/privacy"
import { currentStagesOf, personOf, serviceOf, stageOf, userOf } from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { viewerInfo } from "./present"

function row(s: State, r: DataRequest, today: string) {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    /** Null once the data is erased; then erasedSubject describes who it was. */
    subjectName: r.subjectName,
    erasedSubject: r.erasedSubject,
    requestedBy: r.requestedBy,
    channel: r.channel,
    receivedAt: r.receivedAt,
    dueOn: r.dueOn,
    daysLeft: daysUntil(r.dueOn, today),
    note: r.note,
    outcome: r.outcome,
    declineReason: r.declineReason,
    closedAt: r.closedAt,
    closedBy: userOf(s, r.closedBy)?.displayName ?? null,
  }
}

export type DataRequestRow = ReturnType<typeof row>

/** The data protection log: open requests by due date, then the closed ones. Administrators only. */
export async function getDataRequests(ctx: Context) {
  const { state: s, viewer } = ctx
  if (!can(viewer, "MANAGE_USERS")) return null
  const today = clockToday()
  const rows = s.dataRequests.map((r) => row(s, r, today))
  const groupOf = (personId: string) => {
    const placement = currentStagesOf(s, personId, today)[0]
    return placement ? (stageOf(s, placement.stageId)?.name ?? null) : null
  }
  return {
    open: rows.filter((r) => r.status === "open").sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    closed: rows
      .filter((r) => r.status !== "open")
      .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")),
    // Who a new request can be about.
    people: s.persons
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, group: groupOf(p.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    accounts: s.users
      .map((u) => ({ id: u.id, name: u.displayName, email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    today,
  }
}

export type DataRequestsPage = NonNullable<Awaited<ReturnType<typeof getDataRequests>>>

/** One request with what the app stores about its subject, for the review before acting. */
export async function getDataRequest(ctx: Context, id: string) {
  const { state: s, viewer } = ctx
  if (!can(viewer, "MANAGE_USERS")) return null
  const request = s.dataRequests.find((r) => r.id === id)
  if (!request) return undefined
  const today = clockToday()
  const user = userOf(s, request.userId) ?? s.users.find((u) => u.personId === request.personId)
  const person = personOf(s, request.personId) ?? personOf(s, user?.personId)
  const memberships = person
    ? s.memberships
        .filter((m) => m.personId === person.id)
        .map((m) => ({
          group: stageOf(s, m.stageId)?.name ?? serviceOf(s, m.serviceId)?.name ?? "",
          service: serviceOf(s, m.serviceId)?.name ?? "",
          from: m.startsOn,
          until: m.endsOn,
        }))
    : []
  return {
    request: row(s, request, today),
    member: person
      ? {
          id: person.id,
          name: `${person.firstName} ${person.lastName}`,
          status: person.status,
          memberships,
        }
      : null,
    account: user ? { ...viewerInfo(ctx, user), approved: user.approvedAt !== null } : null,
    isOwnAccount: user?.id === viewer.id,
    inventory: request.status === "open" && (person || user) ? inventoryOf(s, person, user) : null,
    today,
  }
}

export type DataRequestPage = NonNullable<Awaited<ReturnType<typeof getDataRequest>>>

/** For someone's own account page: whether they already asked for their data to be deleted. */
export async function getOwnPrivacy(ctx: Context) {
  const open = ownOpenErasure(ctx.state, ctx.viewer.id)
  return {
    erasureRequested: open ? { receivedAt: open.receivedAt, dueOn: open.dueOn } : null,
  }
}

export type OwnPrivacy = Awaited<ReturnType<typeof getOwnPrivacy>>
