import Link from "next/link"
import { Clock, MapPin } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { useOccasionName } from "@/components/session-card"
import { OneOffBadge, RescheduledBadge, SessionStatusBadge } from "@/components/status"
import { AttendanceBoard } from "@/features/attendance/attendance-board"
import { SessionMenu } from "@/features/schedule/session-dialogs"
import { getFormat } from "@/i18n/server"
import type { OccasionRef } from "@/lib/view-models"
import { getSessionPage } from "@/server/queries/attendance"
import { getStaffContext } from "@/server/request"

function OccasionText({
  occasion,
  label,
}: {
  occasion: OccasionRef
  label: (name: string) => string
}) {
  const name = useOccasionName()

  return <>{label(name(occasion))}</>
}

export default async function SessionPage({ params }: PageProps<"/attendance/[sessionId]">) {
  const { sessionId } = await params
  const page = getSessionPage(await getStaffContext(), sessionId)
  const { session } = page
  const t = await getTranslations("attendance")
  const f = await getFormat()
  const unitHref = session.unit.stageId
    ? `/services/${session.unit.serviceId}/stages/${session.unit.stageId}?year=${session.date.slice(0, 4)}`
    : `/services/${session.unit.serviceId}?tab=schedule&year=${session.date.slice(0, 4)}`

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/attendance" }, { label: session.unit.name }]} />
      <PageBody>
        <PageHeader
          title={session.unit.name}
          description={f.longDate(session.date)}
          meta={
            <>
              <Link
                href={unitHref}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline"
              >
                <ServiceSwatch tone={session.unit.tone} />
                {t("schedule")}
              </Link>
              <SessionStatusBadge status={session.status} />
              {session.kind === "oneOff" ? <OneOffBadge /> : null}
              {session.originalDate && session.kind === "recurring" ? <RescheduledBadge /> : null}
            </>
          }
          actions={<SessionMenu session={session} today={page.today} />}
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-4" aria-hidden="true" />
              {f.timeRange(session.startTime, session.endTime)}
            </span>
            {session.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {session.location}
              </span>
            ) : null}
          </p>
        </PageHeader>
        {session.status === "canceled" ? (
          <p className="border border-destructive/30 bg-danger-soft/40 p-4 text-sm">
            {session.cancelReason ? (
              t("canceledBecause", { reason: session.cancelReason })
            ) : session.occasion ? (
              <OccasionText
                occasion={session.occasion}
                label={(name) => t("canceledFor", { occasion: name })}
              />
            ) : (
              t("canceledInPlan")
            )}
          </p>
        ) : null}
        <AttendanceBoard page={page} />
        {page.history.length > 0 ? (
          <Section title={t("history.title")}>
            <ol className="flex flex-col gap-2 border-s ps-4">
              {page.history.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium">{t(`history.${e.type}`)}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {f.instantLabel(e.occurredAt, page.today)}
                    {e.actor ? ` · ${e.actor.name}` : ""}
                    {e.note && e.type !== "rescheduled" ? ` · ${e.note}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}
      </PageBody>
    </>
  )
}
