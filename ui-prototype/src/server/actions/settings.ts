"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config"
import { getViewer } from "@/server/viewer"

export async function setLanguageAction(locale: string) {
  if (!isLocale(locale)) {
    return
  }

  ;(await cookies()).set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)
  const viewer = await getViewer()

  if (viewer) {
    viewer.language = locale
  }

  revalidatePath("/", "layout")
}

export async function postponePlanningAction(year: number) {
  ;(await cookies()).set(`khmk-planning-later-${Number(year)}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })
  revalidatePath("/", "layout")
}
