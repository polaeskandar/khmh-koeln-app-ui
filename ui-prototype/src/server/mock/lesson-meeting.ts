import { occursOn } from "@/lib/domain/recurrence"
import { addDays } from "@/lib/domain/time"
import type { Lesson, LocalDate, MeetingSession, Uuid } from "@/lib/domain/types"

import { occurrenceOn } from "./generator"
import { scheduleOf, sessionForOccurrence, sessionOf } from "./selectors"
import type { State } from "./state"

/**
 * How a lesson relates to the meeting it is prepared for.
 *
 * A lesson stores (scheduleId, teachingDate), never a session id for regular
 * meetings: the session for that date is created only the day before, and it
 * keeps its occurrence date when moved. Looking the session up by that natural
 * key means the link appears by itself once the session exists, follows a
 * moved session, and shows clearly when the meeting was canceled. One-off
 * sessions have no schedule and are linked by sessionId.
 */
export type LessonMeeting =
  | { kind: "none" }
  | { kind: "planned"; scheduleId: Uuid; date: LocalDate; createdOn: LocalDate }
  | { kind: "session"; session: MeetingSession }
  | { kind: "not-on-schedule"; scheduleId: Uuid; date: LocalDate }

export function lessonMeeting(
  s: State,
  lesson: Pick<Lesson, "scheduleId" | "sessionId" | "teachingDate">
): LessonMeeting {
  if (lesson.sessionId) {
    const session = sessionOf(s, lesson.sessionId)
    return session ? { kind: "session", session } : { kind: "none" }
  }
  if (!lesson.scheduleId) return { kind: "none" }
  const session = sessionForOccurrence(s, lesson.scheduleId, lesson.teachingDate)
  if (session) return { kind: "session", session }
  const schedule = scheduleOf(s, lesson.scheduleId)
  if (schedule && occursOn(schedule.recurrence, lesson.teachingDate)) {
    return {
      kind: "planned",
      scheduleId: schedule.id,
      date: lesson.teachingDate,
      createdOn: addDays(lesson.teachingDate, -1),
    }
  }
  return { kind: "not-on-schedule", scheduleId: lesson.scheduleId, date: lesson.teachingDate }
}

export type MeetingOption = {
  /** "schedule:<id>:<date>" or "session:<id>" */
  value: string
  scheduleId: Uuid | null
  sessionId: Uuid | null
  date: LocalDate
  startTime: string
  title: string
  state: "planned" | MeetingSession["status"]
  /** Another lesson already prepared for this meeting. */
  takenBy: { id: Uuid; title: string } | null
}

/** Meeting dates a lesson of this stage can be prepared for: schedule dates and one-off sessions. */
export function meetingOptions(
  s: State,
  stageId: Uuid,
  from: LocalDate,
  to: LocalDate,
  exceptLessonId?: Uuid
): MeetingOption[] {
  const lessonsHere = s.lessons.filter(
    (l) => l.stageId === stageId && !l.archivedAt && l.id !== exceptLessonId
  )
  const out: MeetingOption[] = []
  for (const schedule of s.schedules.filter((x) => x.stageId === stageId && x.active)) {
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const occurrence = occurrenceOn(schedule, date)
      if (!occurrence) continue
      const session = sessionForOccurrence(s, schedule.id, date)
      const taken = lessonsHere.find((l) => l.scheduleId === schedule.id && l.teachingDate === date)
      out.push({
        value: `schedule:${schedule.id}:${date}`,
        scheduleId: schedule.id,
        sessionId: null,
        date,
        startTime: occurrence.startsAt.slice(11, 16),
        title: schedule.name,
        state: session?.status ?? "planned",
        takenBy: taken ? { id: taken.id, title: taken.title } : null,
      })
    }
  }
  for (const session of s.sessions.filter((x) => x.stageId === stageId && x.scheduleId === null)) {
    const date = session.occurrenceDate
    if (date < from || date > to) continue
    const taken = lessonsHere.find((l) => l.sessionId === session.id)
    out.push({
      value: `session:${session.id}`,
      scheduleId: null,
      sessionId: session.id,
      date,
      startTime: session.startsAt.slice(11, 16),
      title: session.title,
      state: session.status,
      takenBy: taken ? { id: taken.id, title: taken.title } : null,
    })
  }
  return out.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
}
