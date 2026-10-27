import Link from "next/link"
import { ArrowRight, CircleAlert } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { AgendaRow, SessionCardView, sessionHref } from "@/components/session-bits"
import { ServiceSwatch } from "@/components/service-tag"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { SessionCardAction } from "@/features/attendance/take-attendance"
import { ComingUp } from "@/features/dashboard/coming-up"
import { getFormat, getSessionLines } from "@/i18n/server"
import { getDashboard } from "@/server/queries/dashboard"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("dashboard") }
}

export default async function DashboardPage() {
  const d = await getDashboard(await getStaffContext())
  const [t, tn, tc, f, lines] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("nav"),
    getTranslations("counts"),
    getFormat(),
    getSessionLines(),
  ])
  const open = d.todaySessions.filter((s) => s.status === "active").length
  const notOpened = d.todaySessions.filter((s) => s.status === "scheduled").length

  const summary =
    d.todaySessions.length === 0
      ? t("summary.none")
      : [
          open > 0 ? t("summary.open", { count: open }) : null,
          notOpened > 0 ? t("summary.notOpened", { count: notOpened }) : null,
        ]
          .filter(Boolean)
          .join(f.locale === "ar" ? "، " : ", ") + (open > 0 || notOpened > 0 ? "." : "")

  return (
    <>
      <Topbar crumbs={[{ label: tn("dashboard") }]} />
      <PageBody>
        <PageHeader
          title={d.greeting}
          description={
            <>
              {f.longDate(d.today)} · {f.copticDate(d.today)}
              {summary ? <span className="block text-foreground">{summary}</span> : null}
            </>
          }
        />

        <Section
          id="today"
          title={t("today.title")}
          description={t("today.description")}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/meetings">
                {t("today.allMeetings")} <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          }
        >
          {d.todaySessions.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{t("today.empty")}</EmptyTitle>
                <EmptyDescription>
                  {d.tomorrowSessions.length > 0
                    ? t("today.tomorrow", { names: f.list(d.tomorrowSessions.map((s) => s.group)) })
                    : t("today.checkMeetings")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.todaySessions.map((s) => (
                <SessionCardView
                  key={s.id}
                  session={s}
                  today={d.today}
                  action={<SessionCardAction session={s} today={d.today} />}
                />
              ))}
            </div>
          )}
        </Section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-8">
            {d.attention.length > 0 ? (
              <Section
                id="attention"
                title={t("attention.title")}
                description={t("attention.description")}
              >
                <ul className="divide-y border-y">
                  {d.attention.map((s) => (
                    <li key={s.id}>
                      <AgendaRow
                        item={s}
                        today={d.today}
                        href={sessionHref(s)}
                        trailing={
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-warning uppercase">
                            <CircleAlert className="size-3.5" />
                            {s.status === "active"
                              ? t("attention.notClosed")
                              : t("attention.notTaken")}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section
              id="recent"
              title={t("recent.title")}
              description={t("recent.description")}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/attendance">
                    {t("recent.link")} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              {d.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("recent.empty")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {d.recent.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={sessionHref(s)}
                        className="-mx-2 flex items-center gap-4 px-2 py-3 hover:bg-muted/60"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <ServiceSwatch tone={s.service.tone} />
                            <span className="truncate font-medium">{s.group}</span>
                            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                              · {s.title}
                            </span>
                          </span>
                          <span className="truncate text-sm text-muted-foreground">
                            {f.relativeDay(s.date, d.today)}
                            {f.locale === "ar" ? "، " : ", "}
                            {f.timeRange(s.startTime, s.endTime)}
                            {s.closedAt
                              ? ` · ${
                                  s.closedBy
                                    ? t("recent.closedAtBy", {
                                        time: f.instantTime(s.closedAt),
                                        name: s.closedBy.name,
                                      })
                                    : t("recent.closedAt", { time: f.instantTime(s.closedAt) })
                                }`
                              : ""}
                          </span>
                        </div>
                        <span className="shrink-0 text-end text-sm font-medium tabular-nums">
                          {lines.present(s)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <Section
              id="coming-up"
              title={t("comingUp.title")}
              description={t("comingUp.description")}
            >
              {d.comingUp.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("comingUp.empty")}</p>
              ) : (
                <ComingUp entries={d.comingUp} today={d.today} />
              )}
            </Section>

            <Section
              id="services"
              title={t("services.title")}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/services">
                    {t("services.link")} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              <ul className="divide-y border-y">
                {d.services.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/services/${s.id}`}
                      className="-mx-2 flex items-center gap-3 px-2 py-3 hover:bg-muted/60"
                    >
                      <ServiceSwatch tone={s.tone} className="size-2.5" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[
                            s.stages > 0 ? tc("stages", { count: s.stages }) : null,
                            tc("members", { count: s.members }),
                            s.next
                              ? t("services.next", {
                                  when: f.relativeDayInline(s.next.date, d.today),
                                  time: s.next.startTime,
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-end text-xs text-muted-foreground tabular-nums">
                        {s.trend.rate !== null ? (
                          <>
                            <span className="block text-sm font-medium text-foreground">
                              {f.percent(s.trend.rate)}
                            </span>
                            {t("services.ofRoster")}
                          </>
                        ) : s.trend.averagePresent !== null ? (
                          <>
                            <span className="block text-sm font-medium text-foreground">
                              {s.trend.averagePresent}
                            </span>
                            {t("services.onAverage")}
                          </>
                        ) : (
                          t("services.noSessionsYet")
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  )
}
