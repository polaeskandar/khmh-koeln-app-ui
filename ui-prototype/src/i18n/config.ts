/**
 * The languages of the app. English is the language the prototype was written
 * in; German and Arabic are the languages of the congregation. Arabic is read
 * right to left, so the page direction follows the language.
 */
export const LOCALES = ["en", "de", "ar"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

/** The chosen language, remembered per browser (and on the account once signed in). */
export const LOCALE_COOKIE = "khmk-locale"

/** A year: the choice is a preference, like in the apps. */
export const LOCALE_COOKIE_OPTIONS = {
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const

/** Each language in its own words, for the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  ar: "العربية",
}

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value)

export const directionOf = (locale: Locale): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr")

/** The first supported language in an Accept-Language header ("de-DE,de;q=0.9,en;q=0.8"), if any. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      return { language: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, index }
    })
    .filter((x) => x.language && !Number.isNaN(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  return ranked.map((x) => x.language).find(isLocale) ?? null
}
