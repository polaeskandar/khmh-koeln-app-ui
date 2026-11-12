"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  completeCopy,
  declineRequest,
  erase,
  recordRequest,
  requestOwnErasure,
} from "@/server/mock/commands/privacy"

import { run } from "./run"
import { nullableText, shortText, uuid } from "./schemas"

const request = z.object({
  kind: z.enum(["copy", "erasure"]),
  personId: uuid,
  requestedBy: shortText,
  channel: z.enum(["letter", "in_person"]),
  note: nullableText,
})

export async function recordRequestAction(input: z.input<typeof request>) {
  const data = request.parse(input)

  return run((ctx) => recordRequest(ctx, data).id, msg("toast.requestRecorded"))
}

export async function requestOwnErasureAction() {
  return run((ctx) => requestOwnErasure(ctx).id, msg("toast.erasureRequested"))
}

export async function completeCopyAction(requestId: string) {
  const id = uuid.parse(requestId)

  return run((ctx) => completeCopy(ctx, id), msg("toast.copyHandedOver"))
}

export async function declineRequestAction(requestId: string, reason: string) {
  const id = uuid.parse(requestId)
  const value = shortText.parse(reason)

  return run((ctx) => declineRequest(ctx, id, value), msg("toast.requestDeclined"))
}

export async function eraseAction(requestId: string) {
  const id = uuid.parse(requestId)

  return run((ctx) => erase(ctx, id), msg("toast.erased"))
}
