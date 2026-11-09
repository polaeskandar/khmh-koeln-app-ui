import Link from "next/link"
import { MailCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { ConfirmationLink } from "@/features/auth/confirm-email"
import { requireOutcome } from "@/server/outcome"

export async function generateMetadata() {
  const t = await getTranslations("auth.registered")
  return { title: t("title") }
}

/** Shown right after a registration; otherwise the 404 page (see requireOutcome). */
export default async function RegisteredPage() {
  await requireOutcome("registered")
  const t = await getTranslations("auth.registered")
  return (
    <AuthFrame>
      <span className="inline-flex size-11 items-center justify-center bg-success-soft text-success">
        <MailCheck className="size-5" aria-hidden="true" />
      </span>
      <AuthHeading title={t("title")}>
        <div className="flex max-w-prose flex-col gap-2">
          <p>{t("confirm")}</p>
          <p>{t("text")}</p>
        </div>
      </AuthHeading>
      <p className="max-w-prose text-sm">{t("email")}</p>
      <p className="max-w-prose border border-dashed p-4 text-sm text-muted-foreground">
        {t.rich("prototype", {
          confirm: (chunks) => <ConfirmationLink>{chunks}</ConfirmationLink>,
          link: (chunks) => (
            <Link
              href="/emails/account-approved"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
      <Button variant="outline" asChild className="self-start">
        <Link href="/sign-in">{t("back")}</Link>
      </Button>
    </AuthFrame>
  )
}
