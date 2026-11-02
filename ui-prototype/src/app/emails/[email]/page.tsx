import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { cn } from "cn"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { ChoiceLinks } from "@/features/emails/choice-links"
import { EmailFrame } from "@/features/emails/email-frame"
import { previewHtml } from "@/features/emails/preview"
import { isLocale, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config"
import { isEmailId, isLinkKind, type LinkKind, renderEmail } from "@/server/emails/emails"

const VIEWS = ["desktop", "phone", "text"] as const
type View = (typeof VIEWS)[number]
const COLORS = ["light", "dark"] as const
type Colors = (typeof COLORS)[number]

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export async function generateMetadata({ params }: PageProps<"/emails/[email]">) {
  const [{ email }, t] = await Promise.all([params, getTranslations("emails")])
  return { title: isEmailId(email) ? t(`items.${email}.name`) : t("title") }
}

/**
 * Prototype: one email as the backend will send it, in any of the three languages, on a computer
 * or a phone, light or dark, and as plain text. Every choice is in the URL.
 */
export default async function EmailPage({ params, searchParams }: PageProps<"/emails/[email]">) {
  const [{ email: id }, query, t, uiLocale] = await Promise.all([
    params,
    searchParams,
    getTranslations("emails"),
    getLocale(),
  ])
  if (!isEmailId(id)) notFound()

  const langParam = first(query.lang)
  const lang: Locale = isLocale(langParam) ? langParam : uiLocale
  const linkParam = first(query.link)
  const link: LinkKind = isLinkKind(linkParam) ? linkParam : "office"
  const view: View = VIEWS.find((v) => v === first(query.view)) ?? "desktop"
  const colors: Colors = first(query.colors) === "dark" ? "dark" : "light"
  const hasLink = id === "password-link"

  const email = renderEmail(id, { locale: lang, assetsUrl: "", link })
  const name = t(`items.${id}.name`)

  const state = { lang, link, view, colors }
  const href = (change: Partial<typeof state>) => {
    const next = { ...state, ...change }
    const search = new URLSearchParams({ lang: next.lang })
    if (hasLink) search.set("link", next.link)
    search.set("view", next.view)
    search.set("colors", next.colors)
    return `/emails/${id}?${search}`
  }
  const part = (kind: "html" | "text") =>
    `/emails/${id}/${kind}?${new URLSearchParams(hasLink ? { lang, link } : { lang })}`

  return (
    <AuthFrame className="md:max-w-5xl">
      <Link
        href="/emails"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("all")}
      </Link>
      <AuthHeading title={name}>
        <p className="max-w-prose text-pretty">{t(`items.${id}.when`)}</p>
        <p className="mt-1.5 text-xs">{t(`items.${id}.tickets`)}</p>
      </AuthHeading>

      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <ChoiceLinks
          label={t("language")}
          active={lang}
          items={LOCALES.map((l) => ({
            key: l,
            label: LOCALE_NAMES[l],
            lang: l,
            href: href({ lang: l }),
          }))}
        />
        {hasLink ? (
          <ChoiceLinks
            label={t("link")}
            active={link}
            items={(["office", "forgot"] as const).map((k) => ({
              key: k,
              label: t(`links.${k}`),
              href: href({ link: k }),
            }))}
          />
        ) : null}
        <ChoiceLinks
          label={t("show")}
          active={view}
          items={VIEWS.map((v) => ({ key: v, label: t(`views.${v}`), href: href({ view: v }) }))}
        />
        {view === "text" ? null : (
          <ChoiceLinks
            label={t("colors")}
            active={colors}
            items={COLORS.map((c) => ({
              key: c,
              label: t(`schemes.${c}`),
              href: href({ colors: c }),
            }))}
          />
        )}
      </div>

      <dl
        aria-label={t("envelope")}
        className="grid gap-x-6 gap-y-2 border p-4 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]"
      >
        <dt className="text-muted-foreground">{t("from")}</dt>
        <dd className="min-w-0 break-words">
          <bdi dir="ltr">{email.from}</bdi>
        </dd>
        <dt className="text-muted-foreground">{t("to")}</dt>
        <dd className="min-w-0 break-words">
          <bdi dir="ltr">
            {email.to.name} &lt;{email.to.email}&gt;
          </bdi>
        </dd>
        <dt className="text-muted-foreground">{t("subject")}</dt>
        <dd className="min-w-0 font-medium" lang={lang} dir={email.dir}>
          {email.subject}
        </dd>
        <dt className="text-muted-foreground">{t("preheader")}</dt>
        <dd className="min-w-0" lang={lang} dir={email.dir}>
          {email.preheader}
        </dd>
      </dl>

      {view === "text" ? (
        <div lang={lang} className="border bg-card p-5 text-sm leading-relaxed sm:p-8">
          {email.text.split("\n\n").map((paragraph, i) => (
            <p key={i} dir="auto" className="mb-4 break-words whitespace-pre-wrap last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "border bg-muted/40",
            view === "phone" && "flex justify-center px-4 py-6 sm:py-10"
          )}
        >
          <EmailFrame
            key={`${view}-${colors}`}
            html={previewHtml(email.html, colors)}
            title={t("frame", { name })}
            className={cn(
              view === "phone" ? "w-[375px] max-w-full border bg-background shadow-sm" : "w-full"
            )}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {(["html", "text"] as const).map((kind) => (
          <a
            key={kind}
            href={part(kind)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
          >
            {kind === "html" ? t("openHtml") : t("openText")}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="max-w-prose border border-dashed p-4 text-sm text-muted-foreground">
        {t("notes")}
      </p>
    </AuthFrame>
  )
}
