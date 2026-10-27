import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader, Section } from "@/components/page-header"
import { RecordRequestDialog } from "@/features/privacy/record-request-dialog"
import { DataRequestRows } from "@/features/privacy/request-rows"
import { getDataRequests } from "@/server/queries/privacy"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("privacy.list")
  return { title: t("title") }
}

/** The data protection log: requests to see or delete personal data, and what was done. */
export default async function DataRequestsPage() {
  const ctx = await getStaffContext()
  const [d, t, tn] = await Promise.all([
    getDataRequests(ctx),
    getTranslations("privacy.list"),
    getTranslations("nav"),
  ])
  const crumbs = [{ label: tn("settings"), href: "/settings" }, { label: t("title") }]
  if (d === null) {
    return (
      <>
        <Topbar crumbs={crumbs} />
        <PageBody>
          <NoAccess title={t("adminsOnly")} back={{ href: "/settings", label: tn("settings") }}>
            {t("adminsOnlyHint")}
          </NoAccess>
        </PageBody>
      </>
    )
  }
  if (!d) notFound()
  return (
    <>
      <Topbar crumbs={crumbs} />
      <PageBody>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={<RecordRequestDialog data={d} />}
        />

        <Section id="open" title={t("open", { count: d.open.length })}>
          {d.open.length === 0 ? (
            <p className="flex items-center gap-2 border border-dashed p-4 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              {t("noneOpen")}
            </p>
          ) : (
            <DataRequestRows rows={d.open} today={d.today} variant="open" />
          )}
        </Section>

        <Section id="closed" title={t("closed")} description={t("closedDescription")}>
          {d.closed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noneClosed")}</p>
          ) : (
            <DataRequestRows rows={d.closed} today={d.today} variant="closed" />
          )}
        </Section>

        <p className="max-w-prose text-sm text-muted-foreground">
          {t.rich("notice", {
            link: (chunks) => (
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </PageBody>
    </>
  )
}
