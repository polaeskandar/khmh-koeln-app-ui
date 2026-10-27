"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config"
import { setLanguage } from "@/server/mock/commands/accounts"
import { openState } from "@/server/mock/runtime"
import { getViewer } from "@/server/viewer"

/**
 * Remembers the language for this browser, and on the account when someone is
 * signed in, so it follows them to other devices and their emails use it too.
 * Pages re-render in it right away.
 */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)
  const viewer = await getViewer()
  if (viewer) setLanguage(openState(), viewer, locale)
  revalidatePath("/", "layout")
}
