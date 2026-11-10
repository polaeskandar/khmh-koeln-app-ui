import "server-only"

import { can } from "@/lib/domain/policy"
import { addDays, localDateOf } from "@/lib/domain/time"
import { today as clockToday } from "@/server/mock/clock"
import {
  canEverywhere,
  canIn,
  canInService,
  canSomewhere,
  isUnassigned,
  seesEverything,
} from "@/server/mock/reach"
import { isArchived, isCurrentOn, serviceOf, stageOf, stagesOf } from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { inGroups, personRef, serviceRef, stageRef } from "./present"

/** The member list, for accounts whose roles may see members; null for everyone else. */
export async function listMembers(ctx: Context) {
  ctx = inGroups(ctx)
  const { state: s, viewer } = ctx
  if (!can(viewer, "read", "members")) return null
  // A role for assigned groups changes the people of those groups; a church-wide one anyone.
  const editAnyone = canEverywhere(s, viewer, "update", "members")
  const everyone = seesEverything(s, viewer)
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
    .flatMap((p) => {
      const memberships = s.memberships
        .filter((m) => m.personId === p.id)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
      const current = memberships.filter((m) => isCurrentOn(m, today))
      // Outside the church-wide view, people are seen through a current membership in a group.
      if (!everyone && current.length === 0) return []
      const attended = (attendedByPerson.get(p.id) ?? []).sort((a, b) =>
        b.date.localeCompare(a.date)
      )
      const row = {
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
        canEdit: editAnyone || current.some((m) => canIn(s, viewer, "update", "members", m)),
      }
      return [row]
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
        canManageMembers: canIn(s, viewer, "update", "members", {
          serviceId: x.id,
          stageId: st.id,
        }),
      })),
      canManageMembers: canInService(s, viewer, "update", "members", x.id),
      canManageServiceLevel: canIn(s, viewer, "update", "members", {
        serviceId: x.id,
        stageId: null,
      }),
    }))

  return {
    rows,
    services,
    today,
    counts: {
      active: rows.filter((r) => r.person.status === "active").length,
      inactive: rows.filter((r) => r.person.status === "inactive").length,
    },
    canAdd: canSomewhere(s, viewer, "create", "members"),
    unassigned: isUnassigned(s, viewer),
  }
}

export type MembersPage = NonNullable<Awaited<ReturnType<typeof listMembers>>>
export type MemberRow = MembersPage["rows"][number]

/** Everyone active, with where they belong today: for "add an existing person" pickers. */
export function personDirectory(ctx: Context) {
  ctx = inGroups(ctx)
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
