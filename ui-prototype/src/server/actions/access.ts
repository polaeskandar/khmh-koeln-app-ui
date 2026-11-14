"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import { ACTIONS, type ResourceType } from "@/lib/domain/resources"
import { addManager, removeManager, revokeGrant, saveGrant } from "@/server/mock/commands/access"
import { treeChildren } from "@/server/queries/access"

import { read, run } from "./run"
import { resource, uuid } from "./schemas"

const type = z.enum(["service", "stage", "session", "lesson", "task"] as [
  ResourceType,
  ...ResourceType[],
])

export async function saveGrantAction(
  accountId: string,
  where: z.input<typeof resource>,
  forType: string,
  actions: string[]
) {
  const data = {
    accountId: uuid.parse(accountId),
    resource: resource.parse(where),
    type: type.parse(forType),
    actions: z.array(z.enum(ACTIONS)).max(4).parse(actions),
  }

  return run((ctx) => saveGrant(ctx, data).id, msg("toast.accessSaved"))
}

export async function revokeGrantAction(grantId: string) {
  const id = uuid.parse(grantId)

  return run((ctx) => revokeGrant(ctx, id), msg("toast.accessRemoved"))
}

export async function addManagerAction(accountId: string, where: z.input<typeof resource>) {
  const account = uuid.parse(accountId)
  const place = resource.parse(where)

  return run((ctx) => addManager(ctx, account, place), msg("toast.accessSaved"))
}

export async function removeManagerAction(managerId: string) {
  const id = uuid.parse(managerId)

  return run((ctx) => removeManager(ctx, id), msg("toast.accessRemoved"))
}

export async function treeChildrenAction(key: string, offset: number) {
  const k = z.string().max(120).parse(key)
  const from = z.number().int().min(0).max(10_000).parse(offset)

  return read((ctx) => treeChildren(ctx, k, from))
}
