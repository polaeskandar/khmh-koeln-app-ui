import Link from "next/link"
import { Hourglass } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"

export async function generateMetadata() {
  const t = await getTranslations("auth.pending")
  return { title: t("title") }
}

/** Shown when someone signs in with the right password before an administrator approved the account. */
export default async function PendingPage() {
  const t = await getTranslations("auth.pending")
  return (
    <AuthFrame>
      <span className="inline-flex size-11 items-center justify-center bg-warning-soft text-warning">
        <Hourglass className="size-5" aria-hidden="true" />
      </span>
      <AuthHeading title={t("title")}>
        <p className="max-w-prose">{t("text")}</p>
      </AuthHeading>
      <ul className="flex max-w-prose list-disc flex-col gap-2 ps-5 text-sm">
        <li>{t("parents")}</li>
        <li>{t("servants")}</li>
        <li>{t("email")}</li>
      </ul>
      <p className="max-w-prose text-sm text-muted-foreground">{t("slow")}</p>
      <Button variant="outline" asChild className="self-start">
        <Link href="/sign-in">{t("back")}</Link>
      </Button>
    </AuthFrame>
  )
}
