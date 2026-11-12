import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { PresentBar, SessionCardView } from "@/components/session-card"
import { ServiceSwatch } from "@/components/service-tag"
import { SessionStatusBadge } from "@/components/status"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getFormat } from "@/i18n/server"
import type { SessionCard } from "@/lib/view-models"
import { getAttendanceOverview } from "@/server/queries/attendance"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("attendance") }
}

async function SessionList({ sessions }: { sessions: SessionCard[] }) {
  const f = await getFormat()
  const t = await getTranslations("attendance")

  return (
    <ul className="divide-y border">
      {sessions.map((x) => (
        <li key={x.id}>
          <Link
            href={`/attendance/${x.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="w-28 shrink-0 text-sm tabular-nums">
              {f.dayMonth(x.date)}
              <span className="block text-xs text-muted-foreground">
                {f.timeRange(x.startTime, x.endTime)}
              </span>
            </span>
            <span className="flex min-w-48 flex-1 items-center gap-2 font-medium">
              <ServiceSwatch tone={x.unit.tone} />
              <bdi>{x.unit.name}</bdi>
            </span>
            <span className="flex w-40 flex-col gap-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("presentOf", { present: x.present, roster: x.roster })}
              </span>
              <PresentBar present={x.present} roster={x.roster} />
            </span>
            <SessionStatusBadge status={x.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function AttendancePage() {
  const data = getAttendanceOverview(await getStaffContext())
  const t = await getTranslations("attendance")
  const today = data.today[0]?.date ?? ""

  return (
    <>
      <Topbar crumbs={[{ label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        <Section title={t("today")}>
          {data.today.length === 0 ? (
            <Empty className="border border-dashed py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck />
                </EmptyMedia>
                <EmptyTitle>{t("noneToday")}</EmptyTitle>
                <EmptyDescription>{t("noneTodayHint")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.today.map((x) => (
                <SessionCardView key={x.id} session={x} today={today} />
              ))}
            </div>
          )}
        </Section>
        {data.unfinished.length > 0 ? (
          <Section title={t("unfinished")} description={t("unfinishedHint")}>
            <SessionList sessions={data.unfinished} />
          </Section>
        ) : null}
        <Section title={t("recent")} description={t("recentHint")}>
          {data.recent.length > 0 ? (
            <SessionList sessions={data.recent} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noRecent")}</p>
          )}
        </Section>
      </PageBody>
    </>
  )
}
