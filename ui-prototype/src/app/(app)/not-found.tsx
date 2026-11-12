import Link from "next/link"
import { useTranslations } from "next-intl"

import { PageBody } from "@/components/app-shell/topbar"
import { Button } from "@/components/ui/button"

export default function AppNotFound() {
  const t = useTranslations("notFound")

  return (
    <PageBody>
      <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("app.description")}</p>
      <Button asChild className="self-start">
        <Link href="/">{t("app.action")}</Link>
      </Button>
    </PageBody>
  )
}
