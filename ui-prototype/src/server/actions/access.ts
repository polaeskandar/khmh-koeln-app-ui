"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  assignRole,
  createRole,
  deleteRole,
  removeAssignment,
  updateRole,
} from "@/server/mock/commands/access"

import { run } from "./run"
import { scope, shortText, uuid } from "./schemas"

const role = z.object({ name: shortText, permissions: z.array(z.string().max(60)).max(40) })

export async function createRoleAction(input: z.input<typeof role>) {
  const data = role.parse(input)

  return run((ctx) => createRole(ctx, data.name, data.permissions).id, msg("toast.roleCreated"))
}

export async function updateRoleAction(roleId: string, input: z.input<typeof role>) {
  const id = uuid.parse(roleId)
  const data = role.parse(input)

  return run((ctx) => updateRole(ctx, id, data.name, data.permissions).id, msg("toast.roleSaved"))
}

export async function deleteRoleAction(roleId: string) {
  const id = uuid.parse(roleId)

  return run((ctx) => deleteRole(ctx, id), msg("toast.roleDeleted"))
}

export async function assignRoleAction(
  accountId: string,
  roleId: string,
  input: z.input<typeof scope>
) {
  const account = uuid.parse(accountId)
  const roleValue = uuid.parse(roleId)
  const where = scope.parse(input)

  return run((ctx) => assignRole(ctx, account, roleValue, where).id, msg("toast.roleAssigned"))
}

export async function removeAssignmentAction(assignmentId: string) {
  const id = uuid.parse(assignmentId)

  return run((ctx) => removeAssignment(ctx, id), msg("toast.assignmentRemoved"))
}
