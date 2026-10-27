import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

/** Same message whether the homework doesn't exist, was taken back, or belongs to another family. */
export default function ParentNotFound() {
  const t = useTranslations("notFound.parent")
  return (
    <div className="flex max-w-xl flex-col gap-3 py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <Button asChild className="self-start">
        <Link href="/parent/homework">{t("action")}</Link>
      </Button>
    </div>
  )
}
