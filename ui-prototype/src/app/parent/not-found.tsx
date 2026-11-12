import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export default function PortalNotFound() {
  const t = useTranslations("notFound")

  return (
    <div className="flex flex-col gap-4 py-10">
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("portal.description")}</p>
      <Button asChild className="self-start">
        <Link href="/parent">{t("portal.action")}</Link>
      </Button>
    </div>
  )
}
