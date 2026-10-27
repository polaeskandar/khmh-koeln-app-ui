"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  completeCopyRequest,
  declineDataRequest,
  eraseData,
  recordDataRequest,
  requestOwnErasure,
} from "@/server/mock/commands/privacy"

import { id, optionalId, optionalText, run, text } from "./run"

const request = z.object({
  kind: z.enum(["erasure", "copy"]),
  personId: optionalId.optional(),
  userId: optionalId.optional(),
  requestedBy: text,
  channel: z.enum(["email", "letter", "in_person"]),
  receivedOn: z.string().max(10),
  note: optionalText,
})

/** The office records a request that came by email, letter or in person. */
export async function recordDataRequestAction(input: z.input<typeof request>) {
  return run(
    ({ state, viewer }) => recordDataRequest(state, viewer, request.parse(input)).id,
    msg("toast.dataRequestRecorded")
  )
}

export async function eraseDataAction(requestId: string, clearNotes: boolean) {
  return run(({ state, viewer }) => {
    eraseData(state, viewer, id.parse(requestId), { clearNotes: z.boolean().parse(clearNotes) })
  }, msg("toast.dataErased"))
}

export async function completeCopyRequestAction(requestId: string) {
  return run(({ state, viewer }) => {
    completeCopyRequest(state, viewer, id.parse(requestId))
  }, msg("toast.copySent"))
}

export async function declineDataRequestAction(requestId: string, reason: string) {
  return run(({ state, viewer }) => {
    declineDataRequest(state, viewer, id.parse(requestId), text.parse(reason))
  }, msg("toast.dataRequestDeclined"))
}

/** Someone asks, from their own account, for the account and their data to be deleted. */
export async function requestOwnErasureAction(note: string | null) {
  return run(({ state, viewer }) => {
    requestOwnErasure(state, viewer, optionalText.parse(note) ?? null)
  }, msg("toast.erasureRequested"))
}
