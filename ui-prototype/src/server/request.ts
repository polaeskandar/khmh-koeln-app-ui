import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { isParent, isStaff } from "@/lib/domain/policy"

import { getShell } from "./queries/shell"
import { getContext } from "./viewer"

/** Per-request memoized context: the cookie is read and the generator checked once per render. */
export const getRequestContext = cache(getContext)

export const getShellData = cache(async () => getShell(await getRequestContext()))

/**
 * The staff application (services, meetings, attendance, members, lessons).
 * Parents are sent to their portal before any staff data is read.
 */
export async function getStaffContext() {
  const ctx = await getRequestContext()
  if (!isStaff(ctx.viewer)) redirect(isParent(ctx.viewer) ? "/parent" : "/sign-in")
  return ctx
}

/** The parent portal. Staff who are also parents of a child (common in a parish) can use both. */
export async function getParentContext() {
  const ctx = await getRequestContext()
  if (!isParent(ctx.viewer)) redirect(isStaff(ctx.viewer) ? "/" : "/sign-in")
  return ctx
}
