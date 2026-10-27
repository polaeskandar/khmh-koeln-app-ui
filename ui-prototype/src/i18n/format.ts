import { useLocale } from "next-intl"

import { type Format, formatFor } from "@/lib/format"

/**
 * Dates, times, percentages and schedule patterns in the current language.
 * Works in client components and in server components that are not async;
 * async server components use getFormat() from "@/i18n/server".
 */
export function useFormat(): Format {
  return formatFor(useLocale())
}
