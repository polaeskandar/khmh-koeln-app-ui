import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { DueLabel, KindLabel, useSubjectLabel } from "@/features/privacy/request-bits"
import type { DataRequestsPage } from "@/server/queries/privacy"

/** Settings › Data protection: the open requests at a glance, with a link to the log. */
export function DataProtectionSummary({ data }: { data: DataRequestsPage }) {
  const t = useTranslations("privacy.summary")
  const subject = useSubjectLabel()
  return (
    <Section
      id="data-protection"
      title={t("title")}
      description={t("description")}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/data-requests">
            {t("all")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      }
    >
      {data.open.length === 0 ? (
        <p className="flex items-center gap-2 border border-dashed p-4 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {t("noneOpen")}
        </p>
      ) : (
        <ul className="divide-y border-y">
          {data.open.map((r) => (
            <li
              key={r.id}
              className="relative flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
            >
              <Link
                href={`/settings/data-requests/${r.id}`}
                className="font-medium underline-offset-4 after:absolute after:inset-0 hover:underline"
              >
                {subject(r)}
              </Link>
              <span className="text-muted-foreground">
                <KindLabel kind={r.kind} />
              </span>
              <span className="ms-auto">
                <DueLabel request={r} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
