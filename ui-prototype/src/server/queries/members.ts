import "server-only"

import { can, canInService, isAdministrator } from "@/lib/domain/policy"
import { addDays, localDateOf } from "@/lib/domain/time"
import { today as clockToday } from "@/server/mock/clock"
import { isArchived, isCurrentOn, serviceOf, stageOf, stagesOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { personRef, serviceRef, stageRef } from "./present"

export async function listMembers(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const since = addDays(today, -28)

  // Attendance per person, newest first, for the "last seen" column.
  const sessionsById = new Map(s.sessions.map((x) => [x.id, x]))
  const attendedByPerson = new Map<string, { date: string; group: string; title: string }[]>()
  for (const a of s.attendance) {
    if (a.removedAt) continue
    const session = sessionsById.get(a.sessionId)
    if (!session) continue
    const list = attendedByPerson.get(a.personId) ?? []
    list.push({
      date: localDateOf(session.startsAt),
      group: stageOf(s, session.stageId)?.name ?? serviceOf(s, session.serviceId)!.name,
      title: session.title,
    })
    attendedByPerson.set(a.personId, list)
  }

  const rows = s.persons
    .map((p) => {
      const memberships = s.memberships
        .filter((m) => m.personId === p.id)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
      const current = memberships.filter((m) => isCurrentOn(m, today))
      const attended = (attendedByPerson.get(p.id) ?? []).sort((a, b) =>
        b.date.localeCompare(a.date)
      )
      return {
        person: personRef(p),
        placements: current.map((m) => ({
          membershipId: m.id,
          service: serviceRef(s, serviceOf(s, m.serviceId)!),
          stage: stageRef(stageOf(s, m.stageId)),
          since: m.startsOn,
        })),
        pastPlacements: memberships
          .filter((m) => m.endsOn !== null && m.endsOn < today)
          .map((m) => ({
            membershipId: m.id,
            service: serviceRef(s, serviceOf(s, m.serviceId)!),
            stage: stageRef(stageOf(s, m.stageId)),
            since: m.startsOn,
            until: m.endsOn!,
          })),
        lastAttended: attended[0] ?? null,
        recentAttendance: attended.slice(0, 6),
        attendedLast4Weeks: attended.filter((x) => x.date >= since).length,
        canEdit:
          isAdministrator(viewer) ||
          current.some((m) => can(viewer, "MANAGE_MEMBERS", m.serviceId, m.stageId)),
      }
    })
    .sort(
      (a, b) =>
        a.person.lastName.localeCompare(b.person.lastName, "de") ||
        a.person.firstName.localeCompare(b.person.firstName, "de")
    )

  const services = s.services
    .filter((x) => !isArchived(x))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((x) => ({
      ...serviceRef(s, x),
      stages: stagesOf(s, x.id).map((st) => ({
        ...stageRef(st)!,
        canManageMembers: can(viewer, "MANAGE_MEMBERS", x.id, st.id),
      })),
      canManageMembers: canInService(viewer, "MANAGE_MEMBERS", x.id),
      canManageServiceLevel: can(viewer, "MANAGE_MEMBERS", x.id, null),
    }))

  return {
    rows,
    services,
    today,
    counts: {
      active: rows.filter((r) => r.person.status === "active").length,
      inactive: rows.filter((r) => r.person.status === "inactive").length,
    },
    canAdd: services.some((x) => x.canManageMembers),
  }
}

export type MembersPage = Awaited<ReturnType<typeof listMembers>>
export type MemberRow = MembersPage["rows"][number]

/** Everyone active, with where they belong today: for "add an existing person" pickers. */
export function personDirectory(ctx: Context) {
  const { state: s } = ctx
  const today = clockToday()
  return s.persons
    .filter((p) => p.status === "active")
    .map((p) => ({
      ...personRef(p),
      placements: s.memberships
        .filter((m) => m.personId === p.id && isCurrentOn(m, today))
        .map((m) => ({
          serviceId: m.serviceId,
          stageId: m.stageId,
          label: stageOf(s, m.stageId)?.name ?? serviceOf(s, m.serviceId)!.name,
        })),
    }))
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de")
    )
}

export type DirectoryPerson = ReturnType<typeof personDirectory>[number]
