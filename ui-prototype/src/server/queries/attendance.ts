import "server-only"

import { notFound } from "next/navigation"

import { fullName, matchesQuery, unitName } from "@/lib/domain/names"
import { addDays } from "@/lib/domain/time"
import type { Uuid } from "@/lib/domain/types"
import { can, canSeeSession, canSeeUnit, sessionRef, sessionsWith } from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import {
  currentUnitsOfPerson,
  presentIds,
  rosterOf,
  serviceOf,
  sessionOf,
  stageOf,
} from "@/server/mock/selectors"
import type { Context } from "@/server/viewer"

import { accountRef, bySessionTime, personRef, sessionCard, unitOf } from "./present"

export function getAttendanceOverview(ctx: Context) {
  const { state: s, viewer } = ctx
  const date = today()
  const mine = sessionsWith(s, viewer, "update").filter((x) => canSeeSession(s, viewer, x))

  return {
    today: mine
      .filter((x) => x.date === date)
      .sort(bySessionTime)
      .map((x) => sessionCard(ctx, x)),
    unfinished: mine
      .filter((x) => x.date < date && (x.status === "open" || x.status === "scheduled"))
      .sort(bySessionTime)
      .map((x) => sessionCard(ctx, x)),
    recent: mine
      .filter((x) => x.date < date && x.date >= addDays(date, -21) && x.status === "closed")
      .sort((a, b) => bySessionTime(b, a))
      .map((x) => sessionCard(ctx, x)),
  }
}

export function getSessionPage(ctx: Context, sessionId: Uuid) {
  const { state: s, viewer } = ctx
  const session = sessionOf(s, sessionId)

  if (!session || !canSeeSession(s, viewer, session)) {
    notFound()
  }

  const unit = unitOf(session)
  const present = presentIds(s, session.id)
  const roster = rosterOf(s, unit, session.date)
  const rosterIds = new Set(roster.map((p) => p.id))
  const marks = new Map(
    s.attendance
      .filter((a) => a.sessionId === session.id && a.removedAt === null)
      .map((a) => [a.personId, a])
  )
  const row = (personId: Uuid) => {
    const person = s.persons.find((p) => p.id === personId)!
    const mark = marks.get(personId)

    return {
      person: personRef(person),
      present: present.has(personId),
      recordedAt: mark?.recordedAt ?? null,
      recordedBy: accountRef(s, mark?.recordedBy ?? null),
    }
  }
  const byName = (a: { person: { lastName: string; name: string } }, b: typeof a) =>
    a.person.name.localeCompare(b.person.name, "de")

  return {
    session: sessionCard(ctx, session),
    today: today(),
    roster: roster.map((p) => row(p.id)).sort(byName),
    visitors: [...present]
      .filter((id) => !rosterIds.has(id) && s.persons.some((p) => p.id === id))
      .map(row)
      .sort(byName),
    anonymous: s.anonymousCounts[session.id]?.present ?? 0,
    can: {
      record: can(s, viewer, "session.update", sessionRef(session.id)),
      correct: can(s, viewer, "session.update", sessionRef(session.id)),
      manage: can(s, viewer, "session.update", sessionRef(session.id)),
      unit: canSeeUnit(s, viewer, unit),
    },
  }
}

export function searchPeople(ctx: Context, query: string) {
  const { state: s, viewer } = ctx

  if (query.trim().length < 2 || sessionsWith(s, viewer, "update").length === 0) {
    return []
  }

  return s.persons
    .filter((p) => matchesQuery(p, query))
    .slice(0, 8)
    .map((p) => ({
      ...personRef(p),
      fullName: fullName(p),
      groups: currentUnitsOfPerson(s, p.id, today()).map((u) =>
        unitName(serviceOf(s, u.serviceId)?.name ?? "", stageOf(s, u.stageId)?.name ?? null)
      ),
    }))
}
