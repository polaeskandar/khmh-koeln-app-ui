import Link from "next/link"
import { ArrowLeft, FileWarning } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AuthFrame } from "@/features/auth/auth-frame"
import { PRIVACY_VERSION } from "@/lib/domain/privacy"

export async function generateMetadata() {
  const t = await getTranslations("privacyNotice")
  return { title: t("title") }
}

const SECTIONS = [
  { key: "responsible", items: [] },
  {
    key: "data",
    items: [
      "data.items.accounts",
      "data.items.members",
      "data.items.attendance",
      "data.items.homework",
      "data.items.links",
      "data.items.registration",
    ],
  },
  { key: "why", items: [] },
  {
    key: "who",
    items: ["who.items.servants", "who.items.leaders", "who.items.admins", "who.items.parents"],
  },
  {
    key: "howLong",
    items: ["howLong.items.accounts", "howLong.items.declined", "howLong.items.members"],
  },
  { key: "rights", items: [] },
] as const

/**
 * The privacy notice people accept when they register (DSGVO Art. 13). A
 * draft: the church's data protection adviser completes the bracketed parts.
 */
export default async function PrivacyNoticePage() {
  const t = await getTranslations("privacyNotice")
  return (
    <AuthFrame className="md:max-w-3xl">
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("version", { version: PRIVACY_VERSION })}
        </p>
      </div>
      <p className="flex items-start gap-2 border border-dashed p-4 text-sm">
        <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        {t("draft")}
      </p>
      <p className="max-w-prose leading-relaxed">{t("intro")}</p>
      {SECTIONS.map((section) => (
        <section key={section.key} className="flex max-w-prose flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {t(`${section.key}.title`)}
          </h2>
          {section.items.length > 0 ? (
            <ul className="flex list-disc flex-col gap-2 ps-5 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{t(item)}</li>
              ))}
            </ul>
          ) : null}
          <p className="leading-relaxed whitespace-pre-line">{t(`${section.key}.text`)}</p>
        </section>
      ))}
    </AuthFrame>
  )
}
