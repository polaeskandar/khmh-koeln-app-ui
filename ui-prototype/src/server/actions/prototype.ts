"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { isActiveAccount, isStaff } from "@/lib/domain/policy"
import { resetClock } from "@/server/mock/clock"
import { openState } from "@/server/mock/runtime"
import { resetState } from "@/server/mock/state"
import { PERSONA_COOKIE } from "@/server/viewer"

/** Prototype only: act as another demo user. Replaced by real sign-in with the Symfony API. */
export async function switchPersonaAction(userId: string) {
  const id = z.uuid().parse(userId)
  if (!openState().users.some((u) => u.id === id && isActiveAccount(u))) return
  const store = await cookies()
  store.set(PERSONA_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" })
  revalidatePath("/", "layout")
}

/** Prototype only: the demo "sign-in". Opens the staff app or the parent portal, depending on the account. */
export async function signInAsAction(userId: string) {
  const id = z.uuid().parse(userId)
  const user = openState().users.find((u) => u.id === id && isActiveAccount(u))
  if (!user) redirect("/sign-in/demo")
  const store = await cookies()
  store.set(PERSONA_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" })
  revalidatePath("/", "layout")
  redirect(isStaff(user) ? "/" : "/parent")
}

/** Prototype only: rebuild the demo data from the seed and restart the demo clock. */
export async function resetDemoDataAction() {
  resetState()
  resetClock()
  revalidatePath("/", "layout")
}
