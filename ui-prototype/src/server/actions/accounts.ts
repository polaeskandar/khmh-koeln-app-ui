"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import { approveAccount, declineAccount } from "@/server/mock/commands/accounts"

import { id, optionalId, run } from "./run"

const approval = z.discriminatedUnion("as", [
  z.object({ as: z.literal("parent"), childIds: z.array(id).max(20) }),
  z.object({
    as: z.literal("servant"),
    role: z.enum(["servant", "service_leader"]),
    serviceId: id,
    stageId: optionalId.optional(),
  }),
])

/** Approves a registration: links the children or gives the role. */
export async function approveAccountAction(userId: string, input: z.input<typeof approval>) {
  return run(
    ({ state, viewer }) =>
      approveAccount(state, viewer, id.parse(userId), approval.parse(input)).displayName,
    (name) => msg("toast.accountApproved", { name })
  )
}

/** Declines a registration; the account and what the person entered are deleted. */
export async function declineAccountAction(userId: string) {
  return run(
    ({ state, viewer }) => declineAccount(state, viewer, id.parse(userId)).displayName,
    (name) => msg("toast.accountDeclined", { name })
  )
}
