import Link from "next/link"
import { useTranslations } from "next-intl"

import { KhmkMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

/** Unknown addresses outside the staff app and the parent portal. */
export default function RootNotFound() {
  const t = useTranslations("notFound")
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <KhmkMark className="size-10" />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("root.description")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/">{t("root.openApp")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/parent">{t("root.parentPortal")}</Link>
        </Button>
      </div>
    </main>
  )
}
