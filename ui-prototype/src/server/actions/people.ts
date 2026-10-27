"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import * as commands from "@/server/mock/commands/people"

import { id, optionalId, optionalText, run, text } from "./run"

const reason = z.string().max(5000).nullable()

export async function markPresentAction(sessionId: string, personId: string) {
  return run(({ state, viewer }) => {
    const a = commands.markPresent(state, viewer, id.parse(sessionId), id.parse(personId))
    return { id: a.id, recordedAt: a.recordedAt }
  })
}

export async function removeAttendanceAction(attendanceId: string, why: string | null) {
  return run(({ state, viewer }) => {
    commands.removeAttendance(state, viewer, id.parse(attendanceId), reason.parse(why))
    return null
  })
}

const personInput = z.object({ firstName: text, lastName: text, displayName: optionalText })

export async function createPersonAction(
  input: z.input<typeof personInput> & {
    serviceId: string | null
    stageId: string | null
    allowDuplicate?: boolean
  }
) {
  return run(
    ({ state, viewer }) => {
      const parsed = personInput
        .extend({
          serviceId: optionalId,
          stageId: optionalId,
          allowDuplicate: z.boolean().optional(),
        })
        .parse(input)
      const { person } = commands.createPerson(state, viewer, parsed)
      return { id: person.id, name: `${person.firstName} ${person.lastName}` }
    },
    (r) => msg("toast.added", { name: r.name })
  )
}

export async function updatePersonAction(personId: string, input: z.input<typeof personInput>) {
  return run(({ state, viewer }) => {
    commands.updatePerson(state, viewer, id.parse(personId), personInput.parse(input))
    return null
  }, msg("toast.saved"))
}

export async function setPersonStatusAction(personId: string, status: "active" | "inactive") {
  return run(
    ({ state, viewer }) =>
      commands.setPersonStatus(
        state,
        viewer,
        id.parse(personId),
        z.enum(["active", "inactive"]).parse(status)
      ).status,
    (s) => (s === "active" ? msg("toast.personReactivated") : msg("toast.personInactive"))
  )
}

export async function addMembershipAction(
  personId: string,
  serviceId: string,
  stageId: string | null
) {
  return run(({ state, viewer }) => {
    commands.addMembership(
      state,
      viewer,
      id.parse(personId),
      id.parse(serviceId),
      optionalId.parse(stageId)
    )
    return null
  }, msg("toast.membershipAdded"))
}

export async function endMembershipAction(membershipId: string) {
  return run(({ state, viewer }) => {
    commands.endMembership(state, viewer, id.parse(membershipId))
    return null
  }, msg("toast.membershipEnded"))
}

export async function moveMembershipAction(membershipId: string, stageId: string | null) {
  return run(({ state, viewer }) => {
    commands.moveMembership(state, viewer, id.parse(membershipId), optionalId.parse(stageId))
    return null
  }, msg("toast.membershipMoved"))
}

const role = z.enum(["administrator", "service_leader", "servant", "parent"])

export async function assignRoleAction(
  userId: string,
  newRole: string,
  serviceId: string | null,
  stageId: string | null = null
) {
  return run(({ state, viewer }) => {
    commands.assignRole(
      state,
      viewer,
      id.parse(userId),
      role.parse(newRole),
      optionalId.parse(serviceId),
      optionalId.parse(stageId)
    )
    return null
  }, msg("toast.roleAssigned"))
}

export async function removeRoleAction(
  userId: string,
  oldRole: string,
  serviceId: string | null,
  stageId: string | null = null
) {
  return run(({ state, viewer }) => {
    commands.removeRole(
      state,
      viewer,
      id.parse(userId),
      role.parse(oldRole),
      optionalId.parse(serviceId),
      optionalId.parse(stageId)
    )
    return null
  }, msg("toast.roleRemoved"))
}
