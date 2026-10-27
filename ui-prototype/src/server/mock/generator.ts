import { occursOn } from "@/lib/domain/recurrence"
import { addDays, localInstant, toInstant } from "@/lib/domain/time"
import type { Instant, LocalDate, MeetingSchedule, MeetingSession } from "@/lib/domain/types"

import { uuidv7 } from "./ids"
import { generatableSchedules, sessionForOccurrence } from "./selectors"
import type { GeneratorRun, State } from "./state"

/**
 * The session generator as designed for the backend (not built yet; it will be
 * a scheduled Symfony console command).
 *
 * Creates sessions from active schedules on the calendar day before they take
 * place. Each run covers today (catch-up, in case yesterday's run was missed)
 * and tomorrow. An occurrence that already has a session (scheduled, moved or
 * canceled) is never touched again, so running it any number of times is safe.
 *
 * In the prototype it runs "hourly" on the demo clock, triggered by page loads
 * (see ensureGenerated). It is a simulation of the planned backend job.
 */
export type Occurrence = { date: LocalDate; startsAt: Instant; endsAt: Instant | null }

export function occurrenceOn(schedule: MeetingSchedule, date: LocalDate): Occurrence | null {
  if (!occursOn(schedule.recurrence, date)) return null
  return {
    date,
    startsAt: localInstant(date, schedule.startTime),
    endsAt: schedule.endTime ? localInstant(date, schedule.endTime) : null,
  }
}

/** A session that stands for one schedule occurrence; copies the schedule's details. */
export function sessionFromOccurrence(
  schedule: MeetingSchedule,
  occurrence: Occurrence,
  createdAtMs: number,
  random: () => number = Math.random
): MeetingSession {
  return {
    id: uuidv7(createdAtMs, random),
    serviceId: schedule.serviceId,
    stageId: schedule.stageId,
    scheduleId: schedule.id,
    occurrenceDate: occurrence.date,
    title: schedule.name,
    location: schedule.location,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    status: "scheduled",
    rosterMode: schedule.rosterMode,
    overridden: false,
    cancelReason: null,
    openedAt: null,
    closedAt: null,
    closedBy: null,
    createdAt: toInstant(createdAtMs),
  }
}

export function generate(
  state: State,
  today: LocalDate,
  ranAtMs: number,
  random: () => number = Math.random
): GeneratorRun {
  const tomorrow = addDays(today, 1)
  let created = 0
  let existing = 0
  for (const schedule of generatableSchedules(state)) {
    for (const date of [today, tomorrow]) {
      const occurrence = occurrenceOn(schedule, date)
      if (!occurrence) continue
      if (sessionForOccurrence(state, schedule.id, date)) {
        existing++
        continue
      }
      state.sessions.push(sessionFromOccurrence(schedule, occurrence, ranAtMs, random))
      created++
    }
  }
  return { ranAt: toInstant(ranAtMs), today, tomorrow, created, existing }
}
