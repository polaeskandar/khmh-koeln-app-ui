"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  addAccountGroup,
  changeUsername,
  createAccount,
  endAccountGroup,
  resetPassword,
  deleteAccount,
} from "@/server/mock/commands/accounts"
import { linkChild, unlinkChild } from "@/server/mock/commands/guardians"

import { run } from "./run"
import { scope, shortText, unit, uuid } from "./schemas"

const newAccount = z.object({
  personId: uuid.nullable(),
  firstName: shortText,
  lastName: shortText,
  username: shortText,
  temporaryPassword: shortText,
  roles: z.array(z.object({ roleId: uuid, scope })).max(20),
  groups: z.array(unit).max(20),
  childIds: z.array(uuid).max(20),
})

export async function createAccountAction(input: z.input<typeof newAccount>) {
  const data = newAccount.parse(input)

  return run(
    (ctx) => createAccount(ctx, data),
    (r) => msg("toast.accountCreated", { name: r.name })
  )
}

export async function resetPasswordAction(accountId: string, temporaryPassword: string) {
  const id = uuid.parse(accountId)
  const password = shortText.parse(temporaryPassword)

  return run((ctx) => resetPassword(ctx, id, password), msg("toast.passwordReset"))
}

export async function changeUsernameAction(accountId: string, username: string) {
  const id = uuid.parse(accountId)
  const value = shortText.parse(username)

  return run((ctx) => changeUsername(ctx, id, value), msg("toast.usernameChanged"))
}

export async function deleteAccountAction(accountId: string) {
  const id = uuid.parse(accountId)

  return run((ctx) => deleteAccount(ctx, id), msg("toast.accountDeleted"))
}

export async function addAccountGroupAction(accountId: string, group: z.input<typeof unit>) {
  const id = uuid.parse(accountId)
  const value = unit.parse(group)

  return run((ctx) => addAccountGroup(ctx, id, value), msg("toast.groupAdded"))
}

export async function endAccountGroupAction(membershipId: string) {
  const id = uuid.parse(membershipId)

  return run((ctx) => endAccountGroup(ctx, id), msg("toast.groupRemoved"))
}

export async function linkChildAction(accountId: string, memberId: string) {
  const id = uuid.parse(accountId)
  const member = uuid.parse(memberId)

  return run((ctx) => linkChild(ctx, id, member), msg("toast.childLinked"))
}

export async function unlinkChildAction(guardianshipId: string) {
  const id = uuid.parse(guardianshipId)

  return run((ctx) => unlinkChild(ctx, id), msg("toast.childUnlinked"))
}
