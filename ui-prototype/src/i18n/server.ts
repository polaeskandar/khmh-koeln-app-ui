import "server-only"

import { getLocale, getTranslations } from "next-intl/server"

import { formatFor } from "@/lib/format"

import type { Message } from "./message"

/** Formatting for async server components; see useFormat() for everything else. */
export async function getFormat() {
  return formatFor(await getLocale())
}

/** Turns a message descriptor (from the data layer) into text in the request's language. */
export async function getMessageTranslator() {
  const t = await getTranslations()
  return (message: Message) =>
    // The key is only known at runtime here, so the per-key argument types can't apply.
    (t as unknown as (key: string, values?: Message["values"]) => string)(
      message.key,
      message.values
    )
}
