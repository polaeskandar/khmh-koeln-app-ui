"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import { PERMISSIONS } from "@/lib/domain/policy"
import {
  createRole,
  deleteRole,
  giveRole,
  removeRole,
  updateRole,
} from "@/server/mock/commands/roles"

import { id, run } from "./run"

const roleInput = z.object({
  name: z.string().max(500).nullable().optional(),
  permissions: z.array(z.string().max(40)).max(PERMISSIONS.length),
  scope: z.enum(["church", "assignedGroups"]).optional(),
})

/** Adds a role. Returns its id, so the editor can open it. */
export async function createRoleAction(input: z.input<typeof roleInput>) {
  return run(
    ({ state, viewer }) => {
      const role = createRole(state, viewer, roleInput.parse(input))
      return { id: role.id, name: role.name }
    },
    (r) => msg("toast.roleCreated", { name: r.name })
  )
}

export async function updateRoleAction(roleId: string, input: z.input<typeof roleInput>) {
  return run(({ state, viewer }) => {
    const role = updateRole(state, viewer, id.parse(roleId), roleInput.parse(input))
    return { id: role.id }
  }, msg("toast.roleSaved"))
}

/** Deletes a role; everyone who had it loses it. */
export async function deleteRoleAction(roleId: string) {
  return run(
    ({ state, viewer }) => deleteRole(state, viewer, id.parse(roleId)).role.name,
    (name) => msg("toast.roleDeleted", { name })
  )
}

export async function giveRoleAction(userId: string, roleId: string) {
  return run(({ state, viewer }) => {
    giveRole(state, viewer, id.parse(userId), id.parse(roleId))
    return null
  }, msg("toast.roleAssigned"))
}

export async function removeRoleAction(userId: string, roleId: string) {
  return run(({ state, viewer }) => {
    removeRole(state, viewer, id.parse(userId), id.parse(roleId))
    return null
  }, msg("toast.roleRemoved"))
}
