import { describe, expect, test } from "vitest"

import { previewHtml } from "@/features/emails/preview"
import { LOCALES } from "@/i18n/config"
import { checkTranslations, flatten } from "@/test/catalogs"

import ar from "../../../messages/emails/ar.json"
import de from "../../../messages/emails/de.json"
import en from "../../../messages/emails/en.json"
import { APP_URL, EMAIL_IDS, LINK_HOURS, renderEmail, SAMPLE_TOKEN } from "./emails"
import { escapeHtml, ltr, rich } from "./layout"

checkTranslations("email texts", en, [
  ["German", de],
  ["Arabic", ar],
])

const ASSETS = "https://app.khmk-koeln.com"

describe("the email texts", () => {
  test("hold no markup, so the backend can escape them like any text", () => {
    const withMarkup = [en, de, ar]
      .flatMap((catalog) => [...flatten(catalog)])
      .filter(([, message]) => /[<>&]/.test(message))
      .map(([key]) => key)
    expect(withMarkup).toEqual([])
  })
})

describe.each(EMAIL_IDS)("the %s email", (id) => {
  test.each(LOCALES)("renders in %s, both parts", (locale) => {
    const email = renderEmail(id, { locale, assetsUrl: ASSETS })
    expect(email.html).toContain(`<html lang="${locale}" dir="${email.dir}"`)
    expect(email.html).toContain(`<title>${escapeHtml(email.subject)}</title>`)
    expect(email.html).toContain(`${ASSETS}/email/khmk-mark.png`)
    expect(email.html).toContain(`${APP_URL}/${locale}/privacy`)
    expect(email.html).not.toMatch(/undefined|\[object|\u0001|\u0002/)
    expect(email.text).not.toMatch(/undefined|\[object|\u0001|\u0002|<[a-z]|&[a-z]+;/)
    expect(email.text).toContain(email.to.name)
    expect(email.text).toContain(`${APP_URL}/${locale}/privacy`)
    expect(email.subject.length).toBeLessThanOrEqual(60)
  })

  test("is laid out right to left in Arabic, with addresses left to right", () => {
    const email = renderEmail(id, { locale: "ar", assetsUrl: ASSETS })
    expect(email.dir).toBe("rtl")
    expect(email.html).toContain("text-align:right")
    expect(email.html).not.toContain("text-align:left")
    expect(email.html).toContain(
      `<span dir="ltr" style="unicode-bidi:embed;">${email.to.email}</span>`
    )
  })
})

describe("the password link", () => {
  test("goes to the set-password page in the account's language, with the token after #", () => {
    const email = renderEmail("password-link", { locale: "de", assetsUrl: ASSETS })
    const url = `${APP_URL}/de/set-password/#token=${SAMPLE_TOKEN}`
    expect(email.html).toContain(`href="${url}"`)
    expect(email.text).toContain(`\n${url}\n`)
    expect(SAMPLE_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test.each([
    ["en", "office", "24 hours"],
    ["en", "forgot", "one hour"],
    ["de", "office", "24 Stunden"],
    ["de", "forgot", "einer Stunde"],
    ["ar", "office", "24 ساعة"],
    ["ar", "forgot", "ساعة واحدة"],
  ] as const)("says in %s how long a link from the %s works", (locale, link, duration) => {
    const email = renderEmail("password-link", { locale, assetsUrl: ASSETS, link })
    expect(email.preheader).toContain(duration)
    expect(email.text).toContain(duration)
  })

  test("from the office works 24 hours, asked for on the sign-in page 1 hour", () => {
    expect(LINK_HOURS).toEqual({ office: 24, forgot: 1 })
  })
})

describe("the approval", () => {
  test("links to the sign-in page and names the app's address", () => {
    const email = renderEmail("account-approved", { locale: "en", assetsUrl: ASSETS })
    expect(email.html).toContain(`href="${APP_URL}/en/sign-in"`)
    expect(email.text).toContain(`Sign in: ${APP_URL}/en/sign-in`)
    expect(email.text).toContain("You can always find the app at app.khmk-koeln.com.")
  })
})

describe("the preview", () => {
  test("opens links in a new tab and shows the chosen colors, whatever the device's", () => {
    const { html } = renderEmail("account-approved", { locale: "en", assetsUrl: ASSETS })
    expect(html).toContain("@media (prefers-color-scheme:dark){")
    const dark = previewHtml(html, "dark")
    expect(dark).toContain('<head>\n<base target="_blank">')
    expect(dark).toContain("@media all{.k-canvas")
    expect(previewHtml(html, "light")).toContain("@media not all{.k-canvas")
  })
})

describe("rich text", () => {
  test("escapes the message and plain values, and keeps markup values", () => {
    const format = (v: Record<string, string | number>) => `Hello ${v.name} & ${v.email}`
    const result = rich(format, { name: "<b>Mina</b>", email: ltr("mina@example.org") })
    expect(result.html).toBe(
      'Hello &lt;b&gt;Mina&lt;/b&gt; &amp; <span dir="ltr" style="unicode-bidi:embed;">mina@example.org</span>'
    )
    expect(result.text).toBe("Hello <b>Mina</b> & mina@example.org")
  })
})
