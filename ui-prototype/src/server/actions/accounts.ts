"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import { approveAccount, declineAccount, unlinkMember } from "@/server/mock/commands/accounts"
import { assignGroup, assignmentNames, removeAssignment } from "@/server/mock/commands/assignments"

import { id, optionalId, run } from "./run"

const assignment = z.object({ serviceId: optionalId, stageId: optionalId })

const approval = z.discriminatedUnion("as", [
  z.object({
    as: z.literal("parent"),
    childIds: z.array(id).max(20),
    roleIds: z.array(id).max(20),
  }),
  z.object({
    as: z.literal("servant"),
    roleIds: z.array(id).max(20),
    assignments: z.array(assignment).max(20).optional(),
  }),
  z.object({
    as: z.literal("member"),
    personId: optionalId,
    ageCheck: z.enum(["sixteenOrOlder", "guardianConsent"]).nullable(),
    guardianConsentNote: z.string().max(1000).nullable().optional(),
  }),
])

/** Approves a registration: links the children, gives the roles or links the member record. */
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

/** Removes the link between a member account and its member record (administrators). */
export async function unlinkMemberAction(userId: string) {
  return run(
    ({ state, viewer }) => unlinkMember(state, viewer, id.parse(userId)).displayName,
    (name) => msg("toast.memberUnlinked", { name })
  )
}

/** Assigns an account to a service (and all its stages) or to one stage. */
export async function assignGroupAction(userId: string, input: z.input<typeof assignment>) {
  return run(
    ({ state, viewer }) => {
      const created = assignGroup(state, viewer, id.parse(userId), assignment.parse(input))
      return { id: created.id, ...assignmentNames(state, created) }
    },
    ({ name, where }) => msg("toast.groupAssigned", { name, where })
  )
}

/** Takes an account out of a service or stage. */
export async function removeAssignmentAction(assignmentId: string) {
  return run(
    ({ state, viewer }) =>
      assignmentNames(state, removeAssignment(state, viewer, id.parse(assignmentId))),
    ({ name, where }) => msg("toast.groupRemoved", { name, where })
  )
}
