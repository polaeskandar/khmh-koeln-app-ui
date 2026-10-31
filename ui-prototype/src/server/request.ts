import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { isParent, isStaff } from "@/lib/domain/policy"
import type { User } from "@/lib/domain/types"

import { getShell } from "./queries/shell"
import { getContext } from "./viewer"

/** Per-request memoized context: the cookie is read and the generator checked once per render. */
export const getRequestContext = cache(getContext)

export const getShellData = cache(async () => getShell(await getRequestContext()))

/**
 * Where an account starts: the staff app for staff, the parent portal for parents, and the
 * member portal for everyone else (members, and approved accounts without anything yet, who
 * see there that the office still has to link them).
 */
export function homeOf(user: User): "/" | "/parent" | "/member" {
  return isStaff(user) ? "/" : isParent(user) ? "/parent" : "/member"
}

/**
 * The staff application (services, meetings, attendance, members, lessons).
 * Parents and members are sent to their portal before any staff data is read.
 */
export async function getStaffContext() {
  const ctx = await getRequestContext()
  if (!isStaff(ctx.viewer)) redirect(homeOf(ctx.viewer))
  return ctx
}

/** The parent portal. Staff who are also parents of a child (common in a parish) can use both. */
export async function getParentContext() {
  const ctx = await getRequestContext()
  if (!isParent(ctx.viewer)) redirect(homeOf(ctx.viewer))
  return ctx
}

/**
 * The member portal: the signed-in person's own groups and homework. Open to every signed-in
 * account; its read models only ever use the member record linked to the account, and show
 * that the office still has to link one when there is none.
 */
export async function getMemberContext() {
  return getRequestContext()
}
