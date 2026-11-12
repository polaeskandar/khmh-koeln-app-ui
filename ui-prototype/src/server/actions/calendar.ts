"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  addChurchEvent,
  removeChurchEvent,
  setDaysOffMode,
  toggleDayOff,
  verifyYear,
} from "@/server/mock/commands/calendar"

import { run } from "./run"
import { shortText, uuid } from "./schemas"

const event = z.object({
  date: z.string().max(10),
  name: shortText,
  mode: z.enum(["suggested", "mandatory"]),
  serviceIds: z.array(uuid).max(30),
})

export async function addChurchEventAction(input: z.input<typeof event>) {
  const data = event.parse(input)

  return run((ctx) => addChurchEvent(ctx, data).id, msg("toast.eventAdded"))
}

export async function removeChurchEventAction(occasionId: string) {
  const id = uuid.parse(occasionId)

  return run((ctx) => removeChurchEvent(ctx, id), msg("toast.eventRemoved"))
}

export async function verifyYearAction(year: number) {
  const value = z.number().int().parse(year)

  return run((ctx) => verifyYear(ctx, value), msg("toast.calendarChecked", { year: String(value) }))
}

export async function setDaysOffModeAction(
  serviceId: string,
  year: number,
  mode: "automatic" | "custom"
) {
  const id = uuid.parse(serviceId)
  const y = z.number().int().parse(year)
  const value = z.enum(["automatic", "custom"]).parse(mode)

  return run(
    (ctx) => setDaysOffMode(ctx, id, y, value),
    msg(value === "custom" ? "toast.daysOffCustom" : "toast.daysOffAutomatic")
  )
}

export async function toggleDayOffAction(serviceId: string, date: string) {
  const id = uuid.parse(serviceId)
  const value = z.string().max(10).parse(date)

  return run((ctx) => toggleDayOff(ctx, id, value))
}
