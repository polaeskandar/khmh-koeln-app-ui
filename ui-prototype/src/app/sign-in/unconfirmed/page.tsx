import Link from "next/link"
import { MailWarning } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"

export async function generateMetadata() {
  const t = await getTranslations("auth.unconfirmed")
  return { title: t("title") }
}

/**
 * Shown when someone signs in with the right password before opening the link the registration
 * sent to the address. Until then the office doesn't see the registration.
 */
export default async function UnconfirmedPage() {
  const t = await getTranslations("auth.unconfirmed")
  return (
    <AuthFrame>
      <span className="inline-flex size-11 items-center justify-center bg-warning-soft text-warning">
        <MailWarning className="size-5" aria-hidden="true" />
      </span>
      <AuthHeading title={t("title")}>
        <p className="max-w-prose">{t("text")}</p>
      </AuthHeading>
      <ul className="flex max-w-prose list-disc flex-col gap-2 ps-5 text-sm">
        <li>{t("valid")}</li>
        <li>{t("again")}</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/sign-in">{t("back")}</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/register">{t("register")}</Link>
        </Button>
      </div>
    </AuthFrame>
  )
}
