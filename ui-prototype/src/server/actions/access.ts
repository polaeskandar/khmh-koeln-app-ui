"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import { permissions, scopeTypes } from "@/lib/domain/resources"
import {
  assignRole,
  createRole,
  deleteRole,
  removeAssignment,
  updateRole,
} from "@/server/mock/commands/access"
import {
  explorerChildren,
  previewAssignment,
  previewRevocation,
  searchExplorer,
} from "@/server/queries/access"

import { read, run } from "./run"
import { resource, shortText, uuid } from "./schemas"

const role = z.object({
  name: shortText,
  description: shortText,
  inherits: z.array(uuid).max(20),
  permissions: z.array(z.string().max(60)).max(permissions().length),
  assignableAt: z.array(z.string().max(30)).max(scopeTypes().length),
  delegation: z
    .array(z.object({ roleId: uuid, at: z.array(z.string().max(30)).max(scopeTypes().length) }))
    .max(50),
})

export async function createRoleAction(input: z.input<typeof role>) {
  const data = role.parse(input)

  return run((ctx) => createRole(ctx, data).id, msg("toast.roleCreated"))
}

export async function updateRoleAction(roleId: string, input: z.input<typeof role>) {
  const id = uuid.parse(roleId)
  const data = role.parse(input)

  return run((ctx) => updateRole(ctx, id, data).id, msg("toast.roleSaved"))
}

export async function deleteRoleAction(roleId: string) {
  const id = uuid.parse(roleId)

  return run((ctx) => deleteRole(ctx, id), msg("toast.roleDeleted"))
}

export async function assignRoleAction(
  accountId: string,
  roleId: string,
  scope: z.input<typeof resource>
) {
  const account = uuid.parse(accountId)
  const roleValue = uuid.parse(roleId)
  const where = resource.parse(scope)

  return run((ctx) => assignRole(ctx, account, roleValue, where).id, msg("toast.roleAssigned"))
}

export async function removeAssignmentAction(assignmentId: string) {
  const id = uuid.parse(assignmentId)

  return run((ctx) => removeAssignment(ctx, id), msg("toast.assignmentRemoved"))
}

export async function previewAssignmentAction(
  accountId: string,
  roleId: string,
  scope: z.input<typeof resource>
) {
  const account = uuid.parse(accountId)
  const roleValue = uuid.parse(roleId)
  const where = resource.parse(scope)

  return read((ctx) => previewAssignment(ctx, account, roleValue, where))
}

export async function previewRevocationAction(assignmentId: string) {
  const id = uuid.parse(assignmentId)

  return read((ctx) => previewRevocation(ctx, id))
}

export async function explorerChildrenAction(key: string, offset: number) {
  const k = z.string().max(120).parse(key)
  const from = z.number().int().min(0).max(10_000).parse(offset)

  return read((ctx) => explorerChildren(ctx, k, from))
}

export async function searchResourcesAction(query: string) {
  const q = z.string().max(100).parse(query)

  return read((ctx) => searchExplorer(ctx, q))
}
