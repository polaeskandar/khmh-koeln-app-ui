"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { z } from "zod"

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config"
import { msg } from "@/i18n/message"
import { authenticate, changeOwnPassword } from "@/server/mock/commands/accounts"
import { getState } from "@/server/mock/state"
import { homeOf } from "@/server/request"
import { SESSION_COOKIE } from "@/server/viewer"

import { runDuringPasswordChange } from "./run"

const SESSION = { httpOnly: true, sameSite: "lax", path: "/" } as const

export type SignInState = { error: string | null }

export async function signInAction(input: {
  username: string
  password: string
}): Promise<SignInState> {
  const { username, password } = z
    .object({ username: z.string().max(200), password: z.string().max(200) })
    .parse(input)
  const t = await getTranslations("auth.signIn")
  const s = getState()
  const result = authenticate(s, username, password)

  if (!result.ok) {
    return { error: t("wrong") }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, result.account.id, SESSION)

  if (result.account.language && isLocale(result.account.language)) {
    store.set(LOCALE_COOKIE, result.account.language, LOCALE_COOKIE_OPTIONS)
  }

  revalidatePath("/", "layout")
  redirect(result.account.mustChangePassword ? "/change-password" : homeOf(s, result.account))
}

const passwords = z.object({
  current: z.string().max(300),
  next: z.string().max(300),
  confirmation: z.string().max(300),
})

export async function changePasswordAction(input: z.input<typeof passwords>) {
  const data = passwords.parse(input)

  return runDuringPasswordChange((ctx) => {
    const required = ctx.viewer.mustChangePassword
    changeOwnPassword(ctx.state, ctx.viewer, data.current, data.next, data.confirmation)

    return { home: required ? homeOf(ctx.state, ctx.viewer) : null }
  }, msg("toast.passwordChanged"))
}

export async function signOutAction() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  revalidatePath("/", "layout")
  redirect("/sign-in")
}
