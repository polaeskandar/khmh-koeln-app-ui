import { createTranslator } from "next-intl"

import type { Locale } from "@/i18n/config"
import { CHURCH_TIME_ZONE } from "@/lib/domain/time"
import type { User } from "@/lib/domain/types"
import { formatFor } from "@/lib/format"
import type { State } from "@/server/mock/state"
import type { Context, Translator } from "@/server/viewer"

import ar from "../../messages/ar.json"
import de from "../../messages/de.json"
import en from "../../messages/en.json"

const MESSAGES = { en, de, ar }

/**
 * What a page or server action works with, for tests: the demo state, the
 * signed-in person, and their language (English unless a test asks otherwise).
 */
export function contextFor(state: State, viewer: User, locale: Locale = "en"): Context {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    timeZone: CHURCH_TIME_ZONE,
  }) as unknown as Translator
  return { state, viewer, t, f: formatFor(locale) }
}
