"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import * as commands from "@/server/mock/commands/meetings"

import { id, optionalId, optionalText, run, text } from "./run"

const scheduleInput = z.object({
  serviceId: id,
  stageId: optionalId,
  name: text,
  description: optionalText,
  location: optionalText,
  frequency: z.enum(["weekly", "monthly"]),
  interval: z.coerce.number().int(),
  weekdays: z.array(z.number().int()).max(7),
  monthWeek: z.number().int().nullable(),
  startsOn: text,
  endsOn: z.string().max(20).nullable(),
  startTime: text,
  endTime: z.string().max(10).nullable(),
  rosterMode: z.enum(["expected", "open"]),
})

const moveInput = z.object({ date: text, startTime: text, endTime: z.string().max(10).nullable() })
const reason = z.string().max(5000).nullable()

export async function createScheduleAction(input: z.input<typeof scheduleInput>) {
  return run(
    ({ state, viewer }) => {
      const { schedule, created } = commands.createSchedule(
        state,
        viewer,
        scheduleInput.parse(input)
      )
      return { id: schedule.id, created }
    },
    (r) => msg("toast.scheduleCreated", { created: r.created })
  )
}

export async function updateScheduleAction(
  scheduleId: string,
  input: z.input<typeof scheduleInput>
) {
  return run(
    ({ state, viewer }) => {
      const parsed = scheduleInput.parse(input)
      const { created } = commands.updateSchedule(state, viewer, id.parse(scheduleId), parsed)
      return { created }
    },
    (r) => msg("toast.scheduleSaved", { created: r.created })
  )
}

export async function setScheduleActiveAction(scheduleId: string, active: boolean) {
  return run(
    ({ state, viewer }) => {
      const { created } = commands.setScheduleActive(
        state,
        viewer,
        id.parse(scheduleId),
        z.boolean().parse(active)
      )
      return { active, created }
    },
    (r) =>
      r.active
        ? msg("toast.scheduleActivated", { created: r.created })
        : msg("toast.scheduleDeactivated")
  )
}

export async function deleteScheduleAction(scheduleId: string) {
  return run(
    ({ state, viewer }) => commands.deleteSchedule(state, viewer, id.parse(scheduleId)).name,
    msg("toast.scheduleDeleted")
  )
}

export async function openSessionAction(sessionId: string) {
  return run(
    ({ state, viewer }) => commands.openSession(state, viewer, id.parse(sessionId)).id,
    msg("toast.attendanceOpen")
  )
}

export async function closeSessionAction(sessionId: string) {
  return run(
    ({ state, viewer }) => commands.closeSession(state, viewer, id.parse(sessionId)).id,
    msg("toast.attendanceClosed")
  )
}

export async function reopenSessionAction(sessionId: string, why: string | null) {
  return run(
    ({ state, viewer }) =>
      commands.reopenSession(state, viewer, id.parse(sessionId), reason.parse(why)).id,
    msg("toast.sessionReopened")
  )
}

export async function cancelSessionAction(sessionId: string, why: string | null) {
  return run(
    ({ state, viewer }) =>
      commands.cancelSession(state, viewer, id.parse(sessionId), reason.parse(why)).id,
    msg("toast.sessionCanceled")
  )
}

export async function moveSessionAction(sessionId: string, input: z.input<typeof moveInput>) {
  return run(
    ({ state, viewer }) =>
      commands.moveSession(state, viewer, id.parse(sessionId), moveInput.parse(input)).id,
    msg("toast.sessionMoved")
  )
}

export async function editSessionAction(
  sessionId: string,
  input: { title: string; location: string | null }
) {
  return run(
    ({ state, viewer }) =>
      commands.editSessionDetails(
        state,
        viewer,
        id.parse(sessionId),
        z.object({ title: text, location: z.string().max(5000).nullable() }).parse(input)
      ).id,
    msg("toast.sessionSaved")
  )
}

/** Cancels a planned date ahead of time: the session is created now and canceled, so the generator skips it. */
export async function cancelOccurrenceAction(scheduleId: string, date: string, why: string | null) {
  return run(({ state, viewer }) => {
    const session = commands.materializeOccurrence(
      state,
      viewer,
      id.parse(scheduleId),
      z.string().max(10).parse(date)
    )
    return commands.cancelSession(state, viewer, session.id, reason.parse(why)).id
  }, msg("toast.dateCanceled"))
}

export async function moveOccurrenceAction(
  scheduleId: string,
  date: string,
  input: z.input<typeof moveInput>
) {
  return run(({ state, viewer }) => {
    const session = commands.materializeOccurrence(
      state,
      viewer,
      id.parse(scheduleId),
      z.string().max(10).parse(date)
    )
    return commands.moveSession(state, viewer, session.id, moveInput.parse(input)).id
  }, msg("toast.dateMoved"))
}

const oneOffInput = z.object({
  serviceId: id,
  stageId: optionalId,
  title: text,
  location: z.string().max(5000).nullable(),
  date: text,
  startTime: text,
  endTime: z.string().max(10).nullable(),
  rosterMode: z.enum(["expected", "open"]),
})

export async function createOneOffSessionAction(input: z.input<typeof oneOffInput>) {
  return run(
    ({ state, viewer }) => commands.createOneOffSession(state, viewer, oneOffInput.parse(input)).id,
    msg("toast.oneOffCreated")
  )
}
