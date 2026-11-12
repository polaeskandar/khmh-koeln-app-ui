"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  addOneOffSession,
  cancelSession,
  changePlan,
  discardDraft,
  rescheduleSession,
  restoreSession,
  savePlans,
} from "@/server/mock/commands/schedule"

import { run } from "./run"
import { nullableText, shortText, uuid } from "./schemas"

const localDate = z.string().max(10)
const localTime = z.string().max(5)

const rule = z.object({
  frequency: z.enum(["weekly", "monthly"]),
  interval: z.number().int().min(1).max(6),
  weekday: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  monthWeek: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)])
    .nullable(),
  startTime: localTime,
  endTime: localTime.nullable(),
  startsOn: localDate.nullable(),
  endsOn: localDate.nullable(),
  location: nullableText,
})

const plan = z.object({
  scheduleIds: z.array(uuid).max(30),
  year: z.number().int(),
  rule,
  decisions: z.record(localDate, z.enum(["cancel", "keep"])),
  versions: z.record(z.string(), z.number().int()),
  confirm: z.boolean(),
})

export async function savePlansAction(input: z.input<typeof plan>) {
  const data = plan.parse(input)

  return run(
    (ctx) => savePlans(ctx, data),
    (r) =>
      data.confirm
        ? msg("toast.planConfirmed", { count: r.created, year: String(data.year) })
        : msg("toast.draftSaved", { year: String(data.year) })
  )
}

export async function discardDraftAction(scheduleId: string, year: number) {
  const id = uuid.parse(scheduleId)
  const value = z.number().int().parse(year)

  return run((ctx) => discardDraft(ctx, id, value), msg("toast.draftDiscarded"))
}

const change = z.object({
  scheduleId: uuid,
  year: z.number().int(),
  from: localDate,
  rule,
  version: z.number().int(),
  dryRun: z.boolean(),
})

export async function changePlanAction(input: z.input<typeof change>) {
  const data = change.parse(input)

  return run(
    (ctx) => {
      const outcome = changePlan(ctx, data)

      return {
        replaced: outcome.replaced,
        added: outcome.added,
        kept: outcome.kept.map((x) => x.date),
      }
    },
    data.dryRun ? undefined : msg("toast.planChanged")
  )
}

export async function cancelSessionAction(sessionId: string, reason: string | null) {
  const id = uuid.parse(sessionId)
  const value = shortText.nullable().parse(reason)

  return run((ctx) => cancelSession(ctx, id, value), msg("toast.sessionCanceled"))
}

export async function restoreSessionAction(sessionId: string) {
  const id = uuid.parse(sessionId)

  return run((ctx) => restoreSession(ctx, id), msg("toast.sessionRestored"))
}

const times = z.object({
  date: localDate,
  startTime: localTime,
  endTime: localTime.nullable(),
  location: nullableText,
})

export async function rescheduleSessionAction(sessionId: string, input: z.input<typeof times>) {
  const id = uuid.parse(sessionId)
  const data = times.parse(input)

  return run((ctx) => rescheduleSession(ctx, id, data).id, msg("toast.sessionRescheduled"))
}

export async function addOneOffSessionAction(scheduleId: string, input: z.input<typeof times>) {
  const id = uuid.parse(scheduleId)
  const data = times.parse(input)

  return run((ctx) => addOneOffSession(ctx, id, data).id, msg("toast.oneOffAdded"))
}
