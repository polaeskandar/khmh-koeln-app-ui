import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { EmailThumbnail } from "@/features/emails/email-thumbnail"
import { previewHtml } from "@/features/emails/preview"
import { EMAIL_IDS, renderEmail } from "@/server/emails/emails"

export async function generateMetadata() {
  const t = await getTranslations("emails")
  return { title: t("title") }
}

/** Prototype: the emails the app sends, each with a picture of its top. */
export default async function EmailsPage() {
  const [t, locale] = await Promise.all([getTranslations("emails"), getLocale()])
  return (
    <AuthFrame className="md:max-w-5xl">
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <AuthHeading title={t("title")}>
        <p className="max-w-prose">{t("intro")}</p>
      </AuthHeading>
      <ul className="grid gap-6 md:grid-cols-2">
        {EMAIL_IDS.map((id) => {
          const email = renderEmail(id, { locale, assetsUrl: "" })
          const name = t(`items.${id}.name`)
          return (
            // The whole card opens the email: the name's link covers it (a frame can't sit
            // inside a link).
            <li
              key={id}
              className="group relative flex flex-col border transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
            >
              <EmailThumbnail
                html={previewHtml(email.html, "light")}
                title={t("frame", { name })}
                className="border-b"
              />
              <div className="flex flex-col gap-1.5 p-4">
                <h2 className="font-heading text-base font-semibold tracking-tight">
                  <Link
                    href={`/emails/${id}`}
                    className="underline-offset-4 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {name}
                  </Link>
                </h2>
                <p className="text-sm text-pretty text-muted-foreground">{t(`items.${id}.when`)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("subject")}: <span className="text-foreground">{email.subject}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t(`items.${id}.tickets`)}</p>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="max-w-prose border border-dashed p-4 text-sm text-muted-foreground">
        {t("notes")}
      </p>
    </AuthFrame>
  )
}
