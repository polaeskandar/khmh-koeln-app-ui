import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { isActiveAccount } from "@/lib/domain/policy"
import type { User } from "@/lib/domain/types"
import { type Format, formatFor } from "@/lib/format"

import { openState } from "./mock/runtime"
import type { State } from "./mock/state"

/**
 * The signed-in person. The prototype's session is a cookie with the account
 * id, set by the sign-in page (email and password, or a demo account) and by
 * "View as" in the user menu, so every role can be tried. With the real
 * backend this becomes the API's session (GET /api/auth/me).
 */
export const PERSONA_COOKIE = "khmk-persona"

/** Translations for the request's language, for read models that put words together. */
export type Translator = Awaited<ReturnType<typeof getTranslations<never>>>

export type Context = { state: State; viewer: User; t: Translator; f: Format }

/** The signed-in account, or null: no session, or the account is waiting for approval or disabled. */
export async function getViewer(): Promise<User | null> {
  const id = (await cookies()).get(PERSONA_COOKIE)?.value
  if (!id) return null
  return openState().users.find((u) => u.id === id && isActiveAccount(u)) ?? null
}

/** Everything a page or server action of a signed-in person needs. Sends everyone else to sign-in. */
export async function getContext(): Promise<Context> {
  const [viewer, t, locale] = await Promise.all([getViewer(), getTranslations(), getLocale()])
  if (!viewer) redirect("/sign-in")
  return { state: openState(), viewer, t, f: formatFor(locale) }
}
