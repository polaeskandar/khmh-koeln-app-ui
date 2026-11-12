import Link from "next/link"
import { FileDown, Trash2 } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { StatusBadge } from "@/components/status"
import { RecordRequestDialog } from "@/features/privacy/data-actions"
import { getFormat } from "@/i18n/server"
import { daysUntil } from "@/lib/domain/privacy"
import type { DataRequest } from "@/lib/domain/types"
import { getDataRequests } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("data") }
}

async function Rows({ rows, today }: { rows: DataRequest[]; today: string }) {
  const t = await getTranslations("data")
  const f = await getFormat()

  return (
    <ul className="divide-y border">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/admin/data/${r.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40"
          >
            {r.kind === "copy" ? (
              <FileDown className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="flex min-w-48 flex-1 flex-col">
              <span className="font-medium">
                {r.subjectName ?? t("erasedSubject", { what: r.erasedSubject ?? "" })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`kinds.${r.kind}`)} · {r.requestedBy}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">
              {f.dayMonth(r.receivedAt.slice(0, 10))}
            </span>
            {r.status === "open" ? (
              <StatusBadge tone={daysUntil(r.dueOn, today) <= 7 ? "warning" : "info"}>
                {t("dueIn", { days: daysUntil(r.dueOn, today) })}
              </StatusBadge>
            ) : (
              <StatusBadge tone={r.status === "done" ? "success" : "muted"}>
                {t(`status.${r.status}`)}
              </StatusBadge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function DataPage() {
  const data = getDataRequests(await getStaffContext())
  const t = await getTranslations("data")
  const tn = await getTranslations("nav")

  return (
    <>
      <Topbar crumbs={[{ label: tn("administration") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={<RecordRequestDialog people={data.people} />}
        />
        <Section title={t("open")} description={t("openHint")}>
          {data.open.length > 0 ? (
            <Rows rows={data.open} today={data.today} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noneOpen")}</p>
          )}
        </Section>
        {data.closed.length > 0 ? (
          <Section title={t("closed")}>
            <Rows rows={data.closed} today={data.today} />
          </Section>
        ) : null}
      </PageBody>
    </>
  )
}
