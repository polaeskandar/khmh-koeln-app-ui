import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { CHURCH_TIME_ZONE } from "@/lib/domain/time"

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, negotiateLocale } from "./config"

/**
 * The language of a request: the one the person chose (cookie), else the first
 * supported language of the browser, else English. The prototype keeps the
 * language out of the URL: it is a preference, like in the apps.
 */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(chosen)
    ? chosen
    : (negotiateLocale((await headers()).get("accept-language")) ?? DEFAULT_LOCALE)
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: CHURCH_TIME_ZONE,
  }
})
