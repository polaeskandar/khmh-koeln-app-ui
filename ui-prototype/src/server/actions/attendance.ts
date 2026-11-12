"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  closeSession,
  openSession,
  reopenSession,
  setPresent,
} from "@/server/mock/commands/attendance"
import { searchPeople } from "@/server/queries/attendance"
import { getContext } from "@/server/viewer"

import { run } from "./run"
import { shortText, uuid } from "./schemas"

export async function openSessionAction(sessionId: string) {
  const id = uuid.parse(sessionId)

  return run((ctx) => openSession(ctx, id), msg("toast.attendanceOpened"))
}

export async function closeSessionAction(sessionId: string) {
  const id = uuid.parse(sessionId)

  return run((ctx) => closeSession(ctx, id), msg("toast.attendanceClosed"))
}

export async function reopenSessionAction(sessionId: string, reason: string) {
  const id = uuid.parse(sessionId)
  const value = shortText.parse(reason)

  return run((ctx) => reopenSession(ctx, id, value), msg("toast.attendanceReopened"))
}

export async function setPresentAction(sessionId: string, personId: string, present: boolean) {
  const session = uuid.parse(sessionId)
  const person = uuid.parse(personId)
  const value = z.boolean().parse(present)

  return run((ctx) => setPresent(ctx, session, person, value))
}

export async function searchPeopleAction(query: string) {
  const value = shortText.parse(query)

  return searchPeople(await getContext(), value)
}
