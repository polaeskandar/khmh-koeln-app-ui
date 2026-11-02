import "server-only"

import { directionOf, isLocale, type Locale } from "@/i18n/config"

import {
  type EmailContent,
  emailTranslator,
  inlineLink,
  plain,
  renderHtml,
  renderText,
  rich,
} from "./layout"

/**
 * The emails the app sends, with fictional sample data. The backend sends them through Symfony
 * Mailer and Mailgun (#17), as Twig templates of the same names with the texts of
 * messages/emails/*.json; the only personal data in them are the recipient's name and address.
 *
 * - `password_link` (#30, at launch): a one-time link to choose a new password. The office's
 *   links work 24 hours; after #97 people ask for one on the sign-in page and it works 1 hour.
 * - `account_approved` (#97, after launch): the office approved a registration. Declining a
 *   registration sends nothing.
 */

/** The web app in production: the backend's FRONTEND_URL (backend docs/operations.md). */
export const APP_URL = "https://app.khmk-koeln.com"

/** The backend's MAILER_FROM. An example: the address is set up with Mailgun (#17). */
export const FROM = "KHMK Köln <no-reply@khmk-koeln.com>"

export const EMAIL_IDS = ["password-link", "account-approved"] as const
export type EmailId = (typeof EMAIL_IDS)[number]

export const isEmailId = (value: unknown): value is EmailId =>
  typeof value === "string" && (EMAIL_IDS as readonly string[]).includes(value)

/** The backend's template names. */
export const TEMPLATES: Record<EmailId, string> = {
  "password-link": "password_link",
  "account-approved": "account_approved",
}

/** How long a password link works: the office's (#30) and the one asked for on the sign-in page (#97). */
export const LINK_HOURS = { office: 24, forgot: 1 } as const
export type LinkKind = keyof typeof LINK_HOURS

export const isLinkKind = (value: unknown): value is LinkKind =>
  value === "office" || value === "forgot"

/** Fictional recipients from the demo data. */
const RECIPIENTS: Record<EmailId, { name: string; email: string }> = {
  "password-link": { name: "Christine Adel", email: "christine.adel@example.org" },
  "account-approved": { name: "Marianne Fanous", email: "marianne.fanous@example.org" },
}

/** A made-up token of the real shape: 32 random bytes in base64url, 43 characters (#30). */
export const SAMPLE_TOKEN = "vT3kq8PzR1mWc6YbN0xHf5LsD2gJa9eUo7iQy4tKnXw"

export type EmailOptions = {
  locale: Locale
  /** Where the mark image is served; the web app in production, this server in the prototype. */
  assetsUrl: string
  /** Password links only: who made the link, which decides how long it works. */
  link?: LinkKind
}

export type RenderedEmail = {
  id: EmailId
  template: string
  locale: Locale
  dir: "ltr" | "rtl"
  from: string
  to: { name: string; email: string }
  subject: string
  preheader: string
  html: string
  text: string
}

function passwordLink({ locale, assetsUrl, link = "office" }: EmailOptions): EmailContent {
  const t = emailTranslator(locale)
  const hours = LINK_HOURS[link]
  const url = `${APP_URL}/${locale}/set-password/#token=${SAMPLE_TOKEN}`
  return {
    locale,
    assetsUrl,
    appUrl: APP_URL,
    recipient: RECIPIENTS["password-link"],
    subject: t("password_link.subject"),
    preheader: t("password_link.preheader", { hours }),
    title: t("password_link.title"),
    blocks: [
      { type: "paragraph", content: plain(t("password_link.intro")) },
      { type: "button", label: t("password_link.button"), href: url, text: "url" },
      { type: "paragraph", content: plain(t("password_link.expiry", { hours })), muted: true },
      { type: "fallback", lead: t("password_link.fallback"), href: url },
    ],
    note: {
      title: t("password_link.notRequestedTitle"),
      lines: [t("password_link.notRequested"), t("password_link.neverAsk")],
    },
  }
}

function accountApproved({ locale, assetsUrl }: EmailOptions): EmailContent {
  const t = emailTranslator(locale)
  const address = new URL(APP_URL).host
  return {
    locale,
    assetsUrl,
    appUrl: APP_URL,
    recipient: RECIPIENTS["account-approved"],
    subject: t("account_approved.subject"),
    preheader: t("account_approved.preheader"),
    title: t("account_approved.title"),
    blocks: [
      { type: "paragraph", content: plain(t("account_approved.intro")) },
      {
        type: "button",
        label: t("account_approved.button"),
        href: `${APP_URL}/${locale}/sign-in`,
        text: "labelled",
      },
      {
        type: "paragraph",
        content: rich((v) => t("account_approved.bookmark", v), {
          address: inlineLink(address, `${APP_URL}/${locale}`),
        }),
        muted: true,
      },
    ],
    note: { title: t("account_approved.forgotTitle"), lines: [t("account_approved.forgot")] },
  }
}

const CONTENT: Record<EmailId, (options: EmailOptions) => EmailContent> = {
  "password-link": passwordLink,
  "account-approved": accountApproved,
}

/** For the raw parts: the language and the link from the query, the image from this server. */
export function renderForRequest(id: EmailId, request: Request): RenderedEmail {
  const url = new URL(request.url)
  const lang = url.searchParams.get("lang")
  const link = url.searchParams.get("link")
  return renderEmail(id, {
    locale: isLocale(lang) ? lang : "en",
    assetsUrl: url.origin,
    link: isLinkKind(link) ? link : "office",
  })
}

export function renderEmail(id: EmailId, options: EmailOptions): RenderedEmail {
  const content = CONTENT[id](options)
  return {
    id,
    template: TEMPLATES[id],
    locale: options.locale,
    dir: directionOf(options.locale),
    from: FROM,
    to: content.recipient,
    subject: content.subject,
    preheader: content.preheader,
    html: renderHtml(content),
    text: renderText(content),
  }
}
