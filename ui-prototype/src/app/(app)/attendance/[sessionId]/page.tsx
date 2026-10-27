import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { SessionBadges, SessionWhen } from "@/components/session-bits"
import { ServiceTag } from "@/components/service-tag"
import { Button } from "@/components/ui/button"
import { AttendanceBoard } from "@/features/attendance/attendance-board"
import { OpenAttendanceButton } from "@/features/attendance/take-attendance"
import { getFormat } from "@/i18n/server"
import { getAttendanceBoard } from "@/server/queries/attendance"
import { getStaffContext } from "@/server/request"
import { isolate } from "@/lib/bidi"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("takeAttendance") }
}

export default async function AttendanceSessionPage({
  params,
}: PageProps<"/attendance/[sessionId]">) {
  const { sessionId } = await params
  const board = await getAttendanceBoard(await getStaffContext(), sessionId)
  if (!board) notFound()
  const s = board.session
  if (s.status === "completed") redirect(`/attendance/${s.id}/summary`)
  const [t, tn, f] = await Promise.all([
    getTranslations("attendance"),
    getTranslations("nav"),
    getFormat(),
  ])

  return (
    <>
      <Topbar crumbs={[{ label: tn("attendance"), href: "/attendance" }, { label: s.group }]} />
      <PageBody className="gap-4 md:gap-6">
        <PageHeader
          meta={
            <>
              <ServiceTag service={s.service} />
              <SessionBadges item={s} />
            </>
          }
          title={s.group}
          description={`${s.title} · ${f.longDate(s.date)}`}
          actions={
            <Button variant="ghost" asChild>
              <Link href={`/meetings/sessions/${s.id}`}>{t("sessionDetails")}</Link>
            </Button>
          }
          actionsClassName="hidden md:flex"
        >
          <SessionWhen item={s} today={board.today} className="mt-1" />
        </PageHeader>

        {s.status === "active" ? (
          <AttendanceBoard board={board} />
        ) : s.status === "canceled" ? (
          <p className="border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span className="font-medium text-destructive">{t("session.canceled")}</span>{" "}
            {s.cancelReason ? `${isolate(s.cancelReason)} ` : ""}
            {t("session.noAttendance")}
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 border border-dashed p-6">
            <h2 className="font-heading text-lg font-semibold">{t("session.notOpen")}</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {s.date > board.today
                ? t("session.opensOn", { date: f.longDate(s.date) })
                : board.can.record
                  ? t("session.openWhenStarts")
                  : t("session.servantsOpen")}
            </p>
            {s.date <= board.today && board.can.record ? (
              <OpenAttendanceButton session={s} size="default" />
            ) : null}
          </div>
        )}
      </PageBody>
    </>
  )
}
