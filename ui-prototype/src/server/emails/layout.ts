import "server-only"

import { createTranslator } from "next-intl"

import { directionOf, type Locale } from "@/i18n/config"

import ar from "../../../messages/emails/ar.json"
import de from "../../../messages/emails/de.json"
import en from "../../../messages/emails/en.json"

/**
 * The frame every email shares, the way the backend's Twig layout will draw it (backend #17):
 * the church's mark and name, a title, the content with one button, a quiet note, and a footer
 * that says why the email came. Mail clients need old HTML: tables for the layout, inline styles,
 * the reader's system font (with Arabic letters in Vazirmatn where the client loads fonts), and
 * nothing that depends on an image (the mark's cell is emerald even when images are blocked). The
 * colors are preset b3a10z1gt0's, converted to hex; clients that honor `prefers-color-scheme`
 * (Apple Mail, Outlook for Mac) get the dark ones.
 *
 * Every email also has a plain-text part with the same words, built from the same blocks.
 */

// ------------------------------------------------------------------ texts

/** The texts of the emails: messages/emails/*.json, the backend's translations/emails.*.yaml. */
export type EmailMessages = typeof en

const CATALOGS: Record<Locale, EmailMessages> = { en, de, ar }

export function emailTranslator(locale: Locale) {
  return createTranslator({
    locale,
    messages: CATALOGS[locale],
    onError: (error) => {
      throw error
    },
  })
}

// ------------------------------------------------------------------ colors

/** Light: the preset's tokens (globals.css) in hex. */
export const COLORS = {
  canvas: "#f5f5f4", // muted (stone 100)
  card: "#ffffff", // card
  ink: "#0c0a09", // foreground (stone 950)
  muted: "#79716b", // muted-foreground (stone 500)
  rule: "#e7e5e4", // border (stone 200)
  note: "#fafaf9", // stone 50
  primary: "#007a55", // primary (emerald 700)
  onPrimary: "#ecfdf5", // primary-foreground (emerald 50)
} as const

/** Dark: the preset's dark tokens, for clients that apply them. */
const DARK = {
  canvas: "#0c0a09",
  card: "#1c1917",
  ink: "#fafaf9",
  muted: "#a6a09b",
  rule: "#33302e", // white at 10% on the card
  note: "#0c0a09",
  primary: "#006045",
  link: "#5ee9b5",
} as const

/**
 * Arabic letters in Vazirmatn, the app's Arabic font, and everything else in the reader's own
 * sans-serif: San Francisco on Apple devices, Segoe UI on Windows, Roboto on Android. Vazirmatn
 * comes first, but its face only covers Arabic (see `arabicFontFace`), so Latin letters go on to
 * the system fonts. Clients that don't load fonts (Gmail, Outlook for Windows) skip it and use
 * their system's Arabic font.
 */
const FONT =
  "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans Arabic', Tahoma, sans-serif"

/**
 * The Arabic subset of Vazirmatn (variable, 100–900), served by the web app next to the mark.
 * From the app's own server, never a font service, which would learn who opened the email. A
 * client only downloads it for an email with Arabic letters.
 */
function arabicFontFace(assetsUrl: string) {
  return (
    "@font-face{font-family:'Vazirmatn';font-style:normal;font-weight:100 900;" +
    `src:url('${assetsUrl}/email/vazirmatn-arabic.woff2') format('woff2');` +
    "unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF;}"
  )
}

/**
 * Outlook for Windows takes the first font of a list and falls back to Times New Roman when it
 * doesn't have it, so it gets one font it has, with Arabic letters too.
 */
const OUTLOOK_FONT =
  "<!--[if mso]><style>body,table,td,p,a,h1{font-family:'Segoe UI',Arial,sans-serif!important;}</style><![endif]-->"

/**
 * Separate style blocks (with the font's in a third): a client that can't read one (Gmail drops
 * a block it doesn't understand) keeps the others. The inline styles alone already make a
 * complete email.
 */
const CSS = [
  "body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}" +
    "table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}" +
    "img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}" +
    // Phones: the card fills the width, with less padding.
    "@media (max-width:620px){.k-outer{padding:16px 0 24px!important;}.k-card{border-left-width:0!important;border-right-width:0!important;}.k-pad{padding-left:24px!important;padding-right:24px!important;}}",
  "@media (prefers-color-scheme:dark){" +
    `.k-canvas{background-color:${DARK.canvas}!important;}` +
    `.k-card{background-color:${DARK.card}!important;border-color:${DARK.rule}!important;}` +
    `.k-rule{border-color:${DARK.rule}!important;}` +
    `.k-ink{color:${DARK.ink}!important;}` +
    `.k-muted{color:${DARK.muted}!important;}` +
    `.k-note{background-color:${DARK.note}!important;border-color:${DARK.rule}!important;}` +
    `.k-btn{background-color:${DARK.primary}!important;}` +
    `.k-a{color:${DARK.link}!important;}` +
    "}",
]

// ------------------------------------------------------------------ escaping

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  )
}

/** A piece of text in both parts of the email. */
export type Rich = { html: string; text: string }

export const plain = (text: string): Rich => ({ html: escapeHtml(text), text })

/**
 * A message whose arguments may carry markup (a link, a left-to-right address). The message and
 * plain arguments are escaped; markup arguments are inserted as they are.
 */
export function rich(
  format: (values: Record<string, string | number>) => string,
  values: Record<string, string | number | Rich>
): Rich {
  const marked: Record<string, string | number> = {}
  const texts: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(values)) {
    marked[key] = typeof value === "object" ? `\u0001${key}\u0002` : value
    texts[key] = typeof value === "object" ? value.text : value
  }
  const html = escapeHtml(format(marked)).replace(
    /\u0001(\w+)\u0002/g,
    (_, key: string) => (values[key] as Rich).html
  )
  return { html, text: format(texts) }
}

/** Addresses and URLs stay left to right inside Arabic sentences. */
export const ltr = (text: string): Rich => ({
  html: `<span dir="ltr" style="unicode-bidi:embed;">${escapeHtml(text)}</span>`,
  text,
})

/** A link inside a sentence. */
export const inlineLink = (label: string, href: string): Rich => ({
  html: `<a class="k-a" href="${escapeHtml(href)}" target="_blank" dir="ltr" style="color:${COLORS.primary};text-decoration:underline;white-space:nowrap;">${escapeHtml(label)}</a>`,
  text: label,
})

// ------------------------------------------------------------------ blocks

/** The content of an email, between the greeting and the note. */
export type Block =
  | { type: "paragraph"; content: Rich; muted?: boolean }
  /** The one action. In the text part: the URL alone, or after its label. */
  | { type: "button"; label: string; href: string; text: "url" | "labelled" }
  /** "If the button doesn't work" and the URL; the text part has the URL already. */
  | { type: "fallback"; lead: string; href: string }

export type EmailContent = {
  locale: Locale
  subject: string
  preheader: string
  title: string
  recipient: { name: string; email: string }
  blocks: Block[]
  /** A quiet box after the content: a title in bold and a few sentences. */
  note: { title: string; lines: string[] }
  /** The web app, the backend's FRONTEND_URL. */
  appUrl: string
  /** Where the mark image is served: the web app in production. */
  assetsUrl: string
}

// ------------------------------------------------------------------ rendering

/** Inline text styles; Arabic gets taller lines and no letter spacing. */
function textStyle(
  rtl: boolean,
  size: number,
  line: number,
  { weight = 400, color = COLORS.ink }: { weight?: 400 | 600; color?: string } = {}
) {
  return [
    "margin:0",
    `font-family:${FONT}`,
    `font-size:${size}px`,
    `line-height:${rtl ? line + 4 : line}px`,
    `font-weight:${weight}`,
    `color:${color}`,
    "mso-line-height-rule:exactly",
  ].join(";")
}

export function renderHtml(email: EmailContent): string {
  const { locale } = email
  const dir = directionOf(locale)
  const rtl = dir === "rtl"
  const start = rtl ? "right" : "left"
  const t = emailTranslator(locale)
  const greeting = rich((v) => t("layout.greeting", v), { name: email.recipient.name })
  const privacyUrl = `${email.appUrl}/${locale}/privacy`
  const sentTo = rich((v) => t("layout.sentTo", v), { email: ltr(email.recipient.email) })
  const muted = (size: number, line: number) => textStyle(rtl, size, line, { color: COLORS.muted })

  const block = (b: Block): string => {
    switch (b.type) {
      case "paragraph":
        return b.muted
          ? `<p class="k-muted" style="${muted(14, 22)};margin-bottom:12px;">${b.content.html}</p>`
          : `<p class="k-ink" style="${textStyle(rtl, 16, 26)};margin-bottom:16px;">${b.content.html}</p>`
      case "button":
        // A table cell carries the color, so the button shows in every client, Outlook included.
        return [
          `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:12px 0 24px;" align="${start}">`,
          `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>`,
          `<td class="k-btn" bgcolor="${COLORS.primary}" style="background-color:${COLORS.primary};">`,
          `<a class="k-btn" href="${escapeHtml(b.href)}" target="_blank" style="display:inline-block;padding:15px 24px;font-family:${FONT};font-size:${rtl ? 15 : 13}px;line-height:18px;font-weight:600;letter-spacing:${rtl ? "0" : "0.08em"};text-transform:uppercase;color:${COLORS.onPrimary};text-decoration:none;mso-line-height-rule:exactly;">${escapeHtml(b.label)}</a>`,
          `</td></tr></table>`,
          `</td></tr></table>`,
        ].join("\n")
      case "fallback":
        return [
          `<p class="k-muted" style="${muted(13, 20)};margin-top:16px;margin-bottom:4px;">${escapeHtml(b.lead)}</p>`,
          `<p dir="ltr" style="${muted(13, 20)};text-align:${start};word-break:break-all;"><a class="k-a" href="${escapeHtml(b.href)}" target="_blank" style="color:${COLORS.primary};text-decoration:underline;">${escapeHtml(b.href)}</a></p>`,
        ].join("\n")
    }
  }

  const note = [
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding-top:28px;">`,
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>`,
    `<td class="k-note" dir="${dir}" style="background-color:${COLORS.note};border:1px solid ${COLORS.rule};padding:16px 20px;text-align:${start};">`,
    `<p class="k-ink" style="${textStyle(rtl, 14, 22, { weight: 600 })};margin-bottom:4px;">${escapeHtml(email.note.title)}</p>`,
    ...email.note.lines.map(
      (line, i, all) =>
        `<p class="k-muted" style="${muted(14, 22)};margin-bottom:${i < all.length - 1 ? 4 : 0}px;">${escapeHtml(line)}</p>`
    ),
    `</td></tr></table>`,
    `</td></tr></table>`,
  ].join("\n")

  // Pads the preview text, so clients don't fill the rest of the preview with the body.
  const previewPadding = "&#847;&zwnj;&nbsp;".repeat(60)

  // The church's name never breaks across lines.
  return keepTogether(`<!DOCTYPE html>
<html lang="${locale}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.subject)}</title>
${[arabicFontFace(email.assetsUrl.replace(/['"()\\<>\s]/g, "")), ...CSS].map((css) => `<style>${css}</style>`).join("\n")}
${OUTLOOK_FONT}
</head>
<body class="k-canvas" dir="${dir}" style="margin:0;padding:0;background-color:${COLORS.canvas};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(email.preheader)}${previewPadding}</div>
<table role="presentation" class="k-canvas" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLORS.canvas}" style="background-color:${COLORS.canvas};">
<tr><td class="k-outer" align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="560"><tr><td><![endif]-->
<table role="presentation" class="k-card" dir="${dir}" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:${COLORS.card};border:1px solid ${COLORS.rule};">
<tr><td class="k-pad k-rule" style="padding:24px 40px;border-bottom:1px solid ${COLORS.rule};">
<table role="presentation" dir="${dir}" border="0" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" valign="middle" bgcolor="${COLORS.primary}" style="width:36px;height:36px;background-color:${COLORS.primary};"><img src="${escapeHtml(email.assetsUrl)}/email/khmk-mark.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;"></td>
<td valign="middle" style="padding-${start}:12px;text-align:${start};">
<p class="k-ink" style="${textStyle(rtl, 17, 22, { weight: 600 })};">KHMK Köln</p>
<p class="k-muted" style="${muted(12, 16)};">${escapeHtml(t("layout.church"))}</p>
</td>
</tr></table>
</td></tr>
<tr><td class="k-pad" dir="${dir}" style="padding:32px 40px 36px;text-align:${start};">
<h1 class="k-ink" style="${textStyle(rtl, 26, 32, { weight: 600 })};letter-spacing:${rtl ? "0" : "-0.01em"};margin-bottom:20px;">${escapeHtml(email.title)}</h1>
<p class="k-ink" style="${textStyle(rtl, 16, 26)};margin-bottom:16px;">${greeting.html}</p>
${email.blocks.map(block).join("\n")}
${note}
</td></tr>
</table>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
<tr><td class="k-pad" dir="${dir}" style="padding:24px 40px 0;text-align:${start};">
<p class="k-muted" style="${muted(12, 18)};margin-bottom:8px;">${sentTo.html}</p>
<p class="k-muted" style="${muted(12, 18)};margin-bottom:8px;">${escapeHtml(t("layout.noReply"))}</p>
<p class="k-muted" style="${muted(12, 18)};"><a class="k-muted" href="${escapeHtml(privacyUrl)}" target="_blank" style="color:${COLORS.muted};text-decoration:underline;">${escapeHtml(t("layout.privacy"))}</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`)
}

const keepTogether = (html: string) => html.replaceAll("KHMK Köln", "KHMK&nbsp;Köln")

export function renderText(email: EmailContent): string {
  const { locale } = email
  const t = emailTranslator(locale)
  const blocks = email.blocks.flatMap((b) => {
    switch (b.type) {
      case "paragraph":
        return [b.content.text]
      case "button":
        return [b.text === "url" ? b.href : `${b.label}: ${b.href}`]
      case "fallback":
        return []
    }
  })
  const sentTo = rich((v) => t("layout.sentTo", v), { email: ltr(email.recipient.email) })
  return [
    email.title,
    t("layout.greeting", { name: email.recipient.name }),
    ...blocks,
    [email.note.title, ...email.note.lines].join(" "),
    ["-- ", "KHMK Köln", t("layout.church")].join("\n"),
    [
      sentTo.text,
      t("layout.noReply"),
      `${t("layout.privacy")}: ${email.appUrl}/${locale}/privacy`,
    ].join("\n"),
  ].join("\n\n")
}
