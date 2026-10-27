import Link from "next/link"
import { MailCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"

export async function generateMetadata() {
  const t = await getTranslations("auth.registered")
  return { title: t("title") }
}

export default async function RegisteredPage() {
  const t = await getTranslations("auth.registered")
  return (
    <AuthFrame>
      <span className="inline-flex size-11 items-center justify-center bg-success-soft text-success">
        <MailCheck className="size-5" aria-hidden="true" />
      </span>
      <AuthHeading title={t("title")}>
        <p className="max-w-prose">{t("text")}</p>
      </AuthHeading>
      <p className="max-w-prose text-sm">{t("email")}</p>
      <p className="max-w-prose border border-dashed p-4 text-sm text-muted-foreground">
        {t("prototype")}
      </p>
      <Button variant="outline" asChild className="self-start">
        <Link href="/sign-in">{t("back")}</Link>
      </Button>
    </AuthFrame>
  )
}
