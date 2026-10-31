import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

/** Same message whether the homework doesn't exist, was taken back, or belongs to another group. */
export default function MemberNotFound() {
  const t = useTranslations("notFound.member")
  return (
    <div className="flex max-w-xl flex-col gap-3 py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Button asChild className="self-start">
        <Link href="/member/homework">{t("action")}</Link>
      </Button>
    </div>
  )
}
