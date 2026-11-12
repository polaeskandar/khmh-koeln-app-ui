"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { resetClock } from "@/server/mock/clock"
import { getState, resetState } from "@/server/mock/state"
import { homeOf } from "@/server/request"
import { SESSION_COOKIE } from "@/server/viewer"

const SESSION = { httpOnly: true, sameSite: "lax", path: "/" } as const

function activeAccount(id: string) {
  return getState().accounts.find((a) => a.id === id)
}

export async function switchPersonaAction(accountId: string) {
  const account = activeAccount(z.uuid().parse(accountId))

  if (!account) {
    return null
  }

  ;(await cookies()).set(SESSION_COOKIE, account.id, SESSION)
  revalidatePath("/", "layout")

  return account.mustChangePassword ? "/change-password" : homeOf(getState(), account)
}

export async function signInAsAction(accountId: string) {
  const target = await switchPersonaAction(accountId)
  redirect(target ?? "/sign-in/demo")
}

export async function resetDemoDataAction(data: "church" | "empty" = "church") {
  resetState(z.enum(["church", "empty"]).parse(data))
  resetClock()
  revalidatePath("/", "layout")
}
