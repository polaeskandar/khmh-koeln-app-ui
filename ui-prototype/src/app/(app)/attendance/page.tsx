import Link from "next/link"
import { CircleAlert, ClipboardCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { AgendaRow, SessionCardView, sessionHref } from "@/components/session-bits"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SessionCardAction } from "@/features/attendance/take-attendance"
import { getFormat } from "@/i18n/server"
import { getAttendanceHome } from "@/server/queries/attendance"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("attendance") }
}

export default async function AttendancePage() {
  const d = await getAttendanceHome(await getStaffContext())
  const [t, tn, f] = await Promise.all([
    getTranslations("attendance.home"),
    getTranslations("nav"),
    getFormat(),
  ])
  return (
    <>
      <Topbar crumbs={[{ label: tn("attendance") }]} />
      <PageBody>
        <PageHeader
          title={tn("attendance")}
          description={t("description", { date: f.longDate(d.today) })}
        />

        <Section id="today" title={t("today")}>
          {d.sessions.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck />
                </EmptyMedia>
                <EmptyTitle>{t("empty")}</EmptyTitle>
                <EmptyDescription>
                  {d.canRecordAnywhere
                    ? t.rich("emptyLink", {
                        link: (chunks) => (
                          <Link href="/meetings" className="underline underline-offset-4">
                            {chunks}
                          </Link>
                        ),
                      })
                    : t("emptyStaff")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.sessions.map((s) => (
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

        <div className="grid gap-10 lg:grid-cols-2">
          {d.earlier.length > 0 ? (
            <Section id="earlier" title={t("earlier")} description={t("earlierDescription")}>
              <ul className="divide-y border-y">
                {d.earlier.map((s) => (
                  <li key={s.id}>
                    <AgendaRow
                      item={s}
                      today={d.today}
                      href={sessionHref(s)}
                      trailing={
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-warning uppercase">
                          <CircleAlert className="size-3.5" aria-hidden="true" />
                          {s.status === "active" ? t("notClosed") : t("notTaken")}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="closed" title={t("recent")}>
            {d.closed.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recentEmpty")}</p>
            ) : (
              <ul className="divide-y border-y">
                {d.closed.map((s) => (
                  <li key={s.id}>
                    <AgendaRow
                      item={s}
                      today={d.today}
                      href={sessionHref(s)}
                      trailing={
                        <span className="text-xs text-muted-foreground">
                          {s.closedAt
                            ? t("closedAt", { when: f.atLabel(s.closedAt, d.today) })
                            : t("closed")}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </PageBody>
    </>
  )
}
