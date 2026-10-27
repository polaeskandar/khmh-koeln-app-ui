import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, ClipboardCheck, Repeat } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { HistoryTimeline } from "@/components/history-timeline"
import { PageHeader, Section } from "@/components/page-header"
import { RosterCells } from "@/components/roster-cells"
import { SessionBadges, sessionHref, SessionWhen } from "@/components/session-bits"
import { ServiceTag } from "@/components/service-tag"
import { Button } from "@/components/ui/button"
import { OpenAttendanceButton } from "@/features/attendance/take-attendance"
import { LessonStatusBadge } from "@/features/lessons/lesson-bits"
import { SessionManageMenu } from "@/features/meetings/session-dialogs"
import { getFormat, getSessionLines } from "@/i18n/server"
import { getSessionDetail } from "@/server/queries/meetings"
import { getStaffContext } from "@/server/request"
import { isolate } from "@/lib/bidi"

export async function generateMetadata() {
  const t = await getTranslations("meetings")
  return { title: t("session.pageTitle") }
}

export default async function SessionPage({ params }: PageProps<"/meetings/sessions/[sessionId]">) {
  const { sessionId } = await params
  const d = await getSessionDetail(await getStaffContext(), sessionId)
  if (!d) notFound()
  const [t, tn, f, lines] = await Promise.all([
    getTranslations("meetings"),
    getTranslations("nav"),
    getFormat(),
    getSessionLines(),
  ])
  const s = d.session
  const schedule = d.schedule
  const c = s.counts
  const canceled = s.status === "canceled"
  const expected = s.rosterMode === "expected" && c.rosterSize !== null

  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("meetings"), href: "/meetings" },
          {
            label: t("session.crumb", {
              group: s.group,
              date: f.longDate(s.date).replace(/ \d{4}$/, ""),
            }),
          },
        ]}
      />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={s.service} />
              <SessionBadges item={s} />
            </>
          }
          title={s.group}
          description={
            <>
              {s.title} · {f.longDate(s.date)}
            </>
          }
          actions={
            <>
              {s.status === "active" && s.can.record ? (
                <Button asChild>
                  <Link href={sessionHref(s)}>
                    <ClipboardCheck data-icon="inline-start" />
                    {tn("takeAttendance")}
                  </Link>
                </Button>
              ) : s.status === "scheduled" && s.can.record && s.date <= d.today ? (
                <OpenAttendanceButton session={s} size="default" />
              ) : s.status === "completed" || (s.status === "active" && !s.can.record) ? (
                <Button variant="outline" asChild>
                  <Link href={`/attendance/${s.id}/summary`}>{t("session.viewAttendance")}</Link>
                </Button>
              ) : null}
              {s.status === "scheduled" && s.can.manage ? (
                <SessionManageMenu
                  session={{
                    id: s.id,
                    title: s.title,
                    group: s.group,
                    location: s.location,
                    date: s.date,
                    startTime: s.startTime,
                    endTime: s.endTime,
                  }}
                />
              ) : null}
            </>
          }
        >
          <SessionWhen item={s} today={d.today} className="mt-1" />
        </PageHeader>

        {canceled ? (
          <p className="border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span className="font-medium text-destructive">{t("session.canceled")}</span>{" "}
            {s.cancelReason
              ? t("session.reason", { reason: isolate(s.cancelReason) })
              : t("session.noReason")}
          </p>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex min-w-0 flex-col gap-8">
            <Section id="attendance" title={tn("attendance")}>
              {canceled ? (
                <p className="text-sm text-muted-foreground">{t("session.noAttendance")}</p>
              ) : (
                <div className="flex flex-col gap-3 border p-5">
                  {expected && c.rosterSize ? (
                    <RosterCells
                      filled={c.rosterPresent}
                      total={c.rosterSize}
                      extra={c.notOnRoster}
                      size="lg"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-heading text-lg font-semibold tabular-nums">
                      {lines.present(s)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {lines.remainder(s, d.today)}
                    </span>
                  </div>
                  {s.status === "scheduled" ? (
                    <p className="text-sm text-muted-foreground">
                      {[
                        s.date <= d.today
                          ? t("session.notOpenYet")
                          : t("session.takenOn", { date: f.longDate(s.date) }),
                        expected
                          ? t("session.rosterIs", {
                              count: c.rosterSize ?? 0,
                              group: s.stage?.name ?? s.service.name,
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  ) : null}
                </div>
              )}
            </Section>

            <Section id="lesson" title={t("session.lesson")}>
              {d.lesson ? (
                <Link
                  href={d.lesson.href}
                  className="flex items-start gap-3 border p-4 hover:bg-muted/60"
                >
                  <BookOpen
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium">{d.lesson.title}</span>
                    <span
                      className={
                        canceled ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                      }
                    >
                      {canceled ? t("session.lessonCanceled") : t("session.lessonPrepared")}
                    </span>
                  </span>
                  <LessonStatusBadge status={d.lesson.status} />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("session.noLesson")}{" "}
                  {s.stage ? (
                    <Link href={`${d.stageHref}/lessons`} className="underline underline-offset-4">
                      {t("session.stageLessons", { stage: s.stage.name })}
                    </Link>
                  ) : null}
                </p>
              )}
            </Section>

            {schedule ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Repeat className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {t.rich("session.fromSchedule", {
                    name: schedule.name,
                    pattern: f.recurrence(schedule.recurrence),
                    link: (chunks) => (
                      <Link
                        href={`/meetings/schedules/${schedule.id}`}
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("session.oneOff")}</p>
            )}
          </div>

          <Section id="history" title={t("session.history")}>
            <HistoryTimeline entries={d.history} today={d.today} />
          </Section>
        </div>
      </PageBody>
    </>
  )
}
