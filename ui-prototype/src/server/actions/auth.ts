"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { z } from "zod"

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config"
import { msg } from "@/i18n/message"
import { isStaff } from "@/lib/domain/policy"
import { authenticate, register } from "@/server/mock/commands/accounts"
import { openState } from "@/server/mock/runtime"
import { PERSONA_COOKIE } from "@/server/viewer"

import { runPublic, text } from "./run"

/**
 * Signing in, registering and signing out. The prototype's session is a
 * cookie with the account id; the Symfony API will issue the real session
 * (see the backend architecture: tokens or cookies).
 */

const SESSION_COOKIE = { httpOnly: true, sameSite: "lax", path: "/" } as const

export type SignInState = { error: string | null }

export async function signInAction(input: {
  email: string
  password: string
}): Promise<SignInState> {
  const { email, password } = z
    .object({ email: z.string().max(200), password: z.string().max(200) })
    .parse(input)
  const t = await getTranslations("auth.signIn")
  const result = authenticate(openState(), email, password)
  if (!result.ok) {
    if (result.reason === "pending") redirect("/sign-in/pending")
    return { error: result.reason === "disabled" ? t("disabled") : t("wrong") }
  }
  const store = await cookies()
  store.set(PERSONA_COOKIE, result.user.id, SESSION_COOKIE)
  // The language chosen on another device comes along.
  if (result.user.language && isLocale(result.user.language)) {
    store.set(LOCALE_COOKIE, result.user.language, LOCALE_COOKIE_OPTIONS)
  }
  revalidatePath("/", "layout")
  redirect(isStaff(result.user) ? "/" : "/parent")
}

const registration = z.object({
  firstName: text,
  lastName: text,
  email: z.string().max(300),
  password: z.string().max(300),
  as: z.enum(["parent", "servant"]),
  details: text,
  serviceId: z.uuid().nullable().optional(),
  acceptPrivacy: z.boolean(),
})

/** Creates an account that waits for an administrator. Nothing is signed in. */
export async function registerAction(input: z.input<typeof registration>) {
  const data = registration.parse(input)
  const locale = await getLocale()
  return runPublic((s) => {
    const user = register(s, { ...data, language: isLocale(locale) ? locale : "en" })
    return { email: user.email }
  }, msg("toast.registered"))
}

/**
 * Asks for a link to choose a new password. The answer is the same whether
 * or not an account exists, so the form can't be used to find out who has one.
 * The prototype sends no email.
 */
export async function forgotPasswordAction(email: string) {
  z.string().max(300).parse(email)
  return { ok: true as const }
}

export async function signOutAction() {
  const store = await cookies()
  store.delete(PERSONA_COOKIE)
  revalidatePath("/", "layout")
  redirect("/sign-in")
}
