import "server-only"

import { occurrencesBetween } from "@/lib/domain/recurrence"
import { addDays, localDateOf, localTimeOf } from "@/lib/domain/time"
import type {
  LocalDate,
  LocalTime,
  Membership,
  Person,
  Recurrence,
  Service,
  Stage,
  Uuid,
} from "@/lib/domain/types"
import type { ServiceRef, StageRef } from "@/lib/view-models"
import { today as clockToday } from "@/server/mock/clock"
import {
  homeworkOf,
  isArchived,
  isCurrentOn,
  lessonOf,
  personOf,
  serviceOf,
  sessionForOccurrence,
  stageOf,
} from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { sortTasks, tasksFor } from "./parent"
import { isGenerating, serviceRef, stageRef } from "./present"

/**
 * Read models for the member portal: what a member sees with an account of
 * their own (a youth, an adult in the Coptic course, an older child whose
 * parents agreed). Data minimisation, as for parents: only the member's own
 * groups, when and where they meet, who serves them, the passage and memory
 * verse of the last lesson, and the homework published for their stages.
 * Lesson plans, servant notes, attendance, cancel reasons and other members
 * are never part of these models.
 */

/** How far ahead "Next meetings" looks. */
const MEETINGS_AHEAD_DAYS = 14
const MEETINGS_SHOWN = 6

export type MemberGroup = {
  /** The membership id: one card per roster the member is on. */
  id: Uuid
  service: ServiceRef
  /** The stage, or null when the member is on the service's own roster (Youth Meeting). */
  stage: StageRef | null
  since: LocalDate
  schedules: {
    id: Uuid
    name: string
    recurrence: Recurrence
    startTime: LocalTime
    endTime: LocalTime | null
    location: string | null
  }[]
  /** The last lesson taught to the stage (never a draft), with what parents see of it too. */
  lastLesson: {
    title: string
    teachingDate: LocalDate
    passage: string | null
    memoryVerse: string | null
  } | null
}

export type MemberMeeting = {
  /** A session id, or schedule@date for a date that has no session yet. */
  key: string
  date: LocalDate
  startTime: LocalTime
  endTime: LocalTime | null
  title: string
  /** The stage name, or the service name for the service's own meetings. */
  group: string
  service: ServiceRef
  location: string | null
  /** Planned: the schedule's date, created the day before. Canceled ones say so, without the reason. */
  status: "planned" | "scheduled" | "active" | "canceled"
  moved: boolean
}

const firstNameOf = (p: Person) => p.displayName ?? p.firstName

/** The rosters the member is on today, in active services and stages: services by name, then stage order. */
function membershipsOf(s: State, person: Person, today: LocalDate) {
  if (person.status !== "active") return []
  return s.memberships
    .filter((m) => m.personId === person.id && isCurrentOn(m, today))
    .flatMap((m) => {
      const service = serviceOf(s, m.serviceId)
      const stage = stageOf(s, m.stageId)
      if (!service || isArchived(service) || (m.stageId && (!stage || isArchived(stage)))) return []
      return [{ m, service, stage: stage ?? null }]
    })
    .sort(
      (a, b) =>
        a.service.name.localeCompare(b.service.name, "de") ||
        (a.stage?.position ?? -1) - (b.stage?.position ?? -1)
    )
}

function lastLessonOf(s: State, stageId: Uuid | null, today: LocalDate) {
  if (!stageId) return null
  const lesson = s.lessons
    .filter(
      (l) =>
        l.stageId === stageId &&
        l.archivedAt === null &&
        l.status !== "draft" &&
        l.teachingDate <= today
    )
    .sort((a, b) => b.teachingDate.localeCompare(a.teachingDate))[0]
  return lesson
    ? {
        title: lesson.title,
        teachingDate: lesson.teachingDate,
        passage: lesson.passage,
        memoryVerse: lesson.memoryVerse,
      }
    : null
}

function groupOf(s: State, m: Membership, service: Service, stage: Stage | null, today: LocalDate) {
  return {
    id: m.id,
    service: serviceRef(s, service),
    stage: stageRef(stage),
    since: m.startsOn,
    schedules: s.schedules
      .filter(
        (sch) => sch.serviceId === m.serviceId && sch.stageId === m.stageId && isGenerating(s, sch)
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((sch) => ({
        id: sch.id,
        name: sch.name,
        recurrence: sch.recurrence,
        startTime: sch.startTime,
        endTime: sch.endTime,
        location: sch.location,
      })),
    lastLesson: lastLessonOf(s, m.stageId, today),
  } satisfies MemberGroup
}

/**
 * The member's meetings from today on: sessions of their groups (the service's own meetings
 * included) and the planned dates that have no session yet. Canceled sessions stay listed so
 * nobody comes for nothing; their reason, written for the servants, is not shown.
 */
function meetingsOf(s: State, person: Person, today: LocalDate): MemberMeeting[] {
  const groups = membershipsOf(s, person, today).map(({ m }) => m)
  const concerns = (x: { serviceId: Uuid; stageId: Uuid | null }) =>
    groups.some(
      (m) => m.serviceId === x.serviceId && (x.stageId === null || x.stageId === m.stageId)
    )
  const to = addDays(today, MEETINGS_AHEAD_DAYS - 1)
  const sessions: MemberMeeting[] = s.sessions
    .filter((x) => concerns(x) && ["scheduled", "active", "canceled"].includes(x.status))
    .filter((x) => {
      const date = localDateOf(x.startsAt)
      return date >= today && date <= to
    })
    .map((x) => {
      const service = serviceOf(s, x.serviceId)!
      return {
        key: x.id,
        date: localDateOf(x.startsAt),
        startTime: localTimeOf(x.startsAt),
        endTime: x.endsAt ? localTimeOf(x.endsAt) : null,
        title: x.title,
        group: stageOf(s, x.stageId)?.name ?? service.name,
        service: serviceRef(s, service),
        location: x.location,
        status: x.status as MemberMeeting["status"],
        moved: s.events.some((e) => e.sessionId === x.id && e.type === "moved"),
      }
    })
  const planned: MemberMeeting[] = s.schedules
    .filter((sch) => concerns(sch) && isGenerating(s, sch))
    .flatMap((sch) => {
      const service = serviceOf(s, sch.serviceId)!
      return occurrencesBetween(sch.recurrence, addDays(today, 1), to)
        .filter((date) => !sessionForOccurrence(s, sch.id, date))
        .map((date) => ({
          key: `${sch.id}@${date}`,
          date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          title: sch.name,
          group: stageOf(s, sch.stageId)?.name ?? service.name,
          service: serviceRef(s, service),
          location: sch.location,
          status: "planned" as const,
          moved: false,
        }))
    })
  return [...sessions, ...planned]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.group.localeCompare(b.group, "de")
    )
    .slice(0, MEETINGS_SHOWN)
}

/** The member record of the signed-in account, or null when the office hasn't linked one. */
function memberOf(ctx: Context) {
  return personOf(ctx.state, ctx.viewer.personId) ?? null
}

function summaryOf(p: Person) {
  return {
    id: p.id,
    name: firstNameOf(p),
    fullName: `${p.firstName} ${p.lastName}`,
    initials: `${firstNameOf(p).charAt(0)}${p.lastName.charAt(0)}`.toUpperCase(),
  }
}

export async function getMemberHome(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const person = memberOf(ctx)
  const tasks = person ? sortTasks(tasksFor(s, person, today, viewer.id)) : []
  return {
    name: person ? firstNameOf(person) : viewer.displayName.split(" ")[0],
    today,
    member: person ? summaryOf(person) : null,
    groups: person
      ? membershipsOf(s, person, today).map((g) => groupOf(s, g.m, g.service, g.stage, today))
      : [],
    meetings: person ? meetingsOf(s, person, today) : [],
    toDo: tasks.filter((t) => !t.done),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 3),
  }
}

export type MemberHome = Awaited<ReturnType<typeof getMemberHome>>

export async function getMemberHomework(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const person = memberOf(ctx)
  const tasks = person ? sortTasks(tasksFor(s, person, today, viewer.id)) : []
  return {
    today,
    member: person ? summaryOf(person) : null,
    toDo: tasks.filter((t) => !t.done),
    done: tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
  }
}

/**
 * One homework task of the member. Drafts, archived tasks, other groups' tasks and unknown ids
 * all give the same answer (null), so nothing leaks about other groups.
 */
export async function getMemberHomeworkDetail(ctx: Context, homeworkId: string) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const person = memberOf(ctx)
  const hw = homeworkOf(s, homeworkId)
  if (!person || !hw || hw.status !== "published") return null
  const task = tasksFor(s, person, today, viewer.id).find((t) => t.id === hw.id)
  if (!task) return null
  const lesson = lessonOf(s, hw.lessonId)!
  return {
    today,
    member: summaryOf(person),
    task,
    resources: hw.resources,
    lesson: {
      title: lesson.title,
      passage: lesson.passage,
      memoryVerse: lesson.memoryVerse,
      teachingDate: lesson.teachingDate,
    },
  }
}

export type MemberHomeworkDetail = NonNullable<Awaited<ReturnType<typeof getMemberHomeworkDetail>>>

/** The member's own account page: who they are and which groups the church has them in. */
export async function getMemberAccount(ctx: Context) {
  const { state: s, viewer } = ctx
  const today = clockToday()
  const person = memberOf(ctx)
  return {
    name: viewer.displayName,
    email: viewer.email,
    member: person
      ? {
          fullName: `${person.firstName} ${person.lastName}`,
          groups: membershipsOf(s, person, today).map((g) => ({
            id: g.m.id,
            service: g.service.name,
            stage: g.stage?.name ?? null,
          })),
        }
      : null,
  }
}
