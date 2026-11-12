import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import type { Account } from "@/lib/domain/types"

import { can, isStaff } from "./mock/access"
import type { State } from "./mock/state"
import { getShell } from "./queries/shell"
import { getContext } from "./viewer"

export const getRequestContext = cache(getContext)

export const getShellData = cache(async () => getShell(await getRequestContext()))

export function homeOf(s: State, account: Account): "/" | "/parent" | "/member" {
  if (isStaff(s, account)) {
    return "/"
  }

  return can(s, account, "portal.parent") ? "/parent" : "/member"
}

export async function getStaffContext() {
  const ctx = await getRequestContext()

  if (!isStaff(ctx.state, ctx.viewer)) {
    redirect(homeOf(ctx.state, ctx.viewer))
  }

  return ctx
}

export async function getParentContext() {
  const ctx = await getRequestContext()

  if (!can(ctx.state, ctx.viewer, "portal.parent")) {
    redirect(homeOf(ctx.state, ctx.viewer))
  }

  return ctx
}

export async function getMemberContext() {
  const ctx = await getRequestContext()

  if (!can(ctx.state, ctx.viewer, "portal.member")) {
    redirect(homeOf(ctx.state, ctx.viewer))
  }

  return ctx
}
