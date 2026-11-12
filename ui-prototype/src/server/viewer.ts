import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import type { Account } from "@/lib/domain/types"
import { type Format, formatFor } from "@/lib/format"

import { getState, type State } from "./mock/state"

export const SESSION_COOKIE = "khmk-session"

export type Translator = Awaited<ReturnType<typeof getTranslations<never>>>

export type Context = { state: State; viewer: Account; t: Translator; f: Format }

export async function getViewer(): Promise<Account | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value

  if (!id) {
    return null
  }

  return getState().accounts.find((a) => a.id === id) ?? null
}

export async function getSignedInContext(): Promise<Context> {
  const [viewer, t, locale] = await Promise.all([getViewer(), getTranslations(), getLocale()])

  if (!viewer) {
    redirect("/sign-in")
  }

  return { state: getState(), viewer, t, f: formatFor(locale) }
}

export async function getContext(): Promise<Context> {
  const ctx = await getSignedInContext()

  if (ctx.viewer.mustChangePassword) {
    redirect("/change-password")
  }

  return ctx
}
