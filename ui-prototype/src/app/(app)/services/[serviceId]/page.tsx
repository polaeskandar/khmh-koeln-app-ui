import Link from "next/link"
import { notFound } from "next/navigation"
import { Archive, ArrowRight, CalendarClock, Layers, Pencil, Plus, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { RosterCells } from "@/components/roster-cells"
import { AgendaRow, sessionHref } from "@/components/session-bits"
import { ServiceSwatch } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScheduleDialog } from "@/features/meetings/schedule-dialog"
import { ScheduleList } from "@/features/meetings/schedule-list"
import { ServiceActionsMenu, ServiceFormDialog } from "@/features/services/service-dialogs"
import { StageFormDialog } from "@/features/stages/stage-dialogs"
import { getFormat, getSessionLines } from "@/i18n/server"
import { today as clockToday } from "@/server/mock/clock"
import { formServices } from "@/server/queries/meetings"
import { getServiceDetail } from "@/server/queries/services"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("services")
  return { title: t("kind") }
}

export default async function ServiceDetailPage({ params }: PageProps<"/services/[serviceId]">) {
  const { serviceId } = await params
  const ctx = await getStaffContext()
  const d = await getServiceDetail(ctx, serviceId)
  if (!d) notFound()
  const [t, ts, tn, tc, tr, tcommon, f, lines] = await Promise.all([
    getTranslations("services"),
    getTranslations("stages"),
    getTranslations("nav"),
    getTranslations("counts"),
    getTranslations("roles"),
    getTranslations("common"),
    getFormat(),
    getSessionLines(),
  ])
  const { service, can } = d
  const today = clockToday()
  const trend = d.stats.trend
  const listSeparator = f.locale === "ar" ? "، " : ", "
  return (
    <>
      <Topbar crumbs={[{ label: tn("services"), href: "/services" }, { label: service.name }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <ServiceSwatch tone={service.tone} className="size-2.5" />
                {t("kind")}
              </span>
              {service.archived ? (
                <StatusBadge tone="muted" icon={Archive}>
                  {tcommon("archived")}
                </StatusBadge>
              ) : null}
            </>
          }
          title={service.name}
          description={
            service.description ? (
              <span dir="auto" className="block">
                {service.description}
              </span>
            ) : undefined
          }
          actions={
            <>
              {can.edit ? (
                <ServiceFormDialog
                  service={{ id: service.id, name: service.name, description: service.description }}
                  trigger={
                    <Button variant="outline">
                      <Pencil data-icon="inline-start" />
                      {tcommon("edit")}
                    </Button>
                  }
                />
              ) : null}
              {can.sessions && !service.archived ? (
                <ScheduleDialog
                  services={formServices(ctx)}
                  today={today}
                  fixedServiceId={service.id}
                />
              ) : null}
              <ServiceActionsMenu
                service={{ id: service.id, name: service.name, description: service.description }}
                archived={service.archived}
                impact={d.impact}
                can={{ edit: false, archive: can.archive }}
                afterDelete="/services"
                variant="button"
              />
            </>
          }
        />

        {service.archived ? (
          <Alert>
            <Archive />
            <AlertTitle>
              {service.archivedAt
                ? t("detail.archivedOn", { date: f.mediumDate(service.archivedAt.slice(0, 10)) })
                : tcommon("archived")}
            </AlertTitle>
            <AlertDescription>{t("detail.archivedNote")}</AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-2 border-y sm:grid-cols-4">
          {[
            { label: t("detail.stats.stages"), value: d.stages.length, icon: Layers },
            { label: t("detail.stats.members"), value: d.stats.members, icon: UsersRound },
            {
              label: t("detail.stats.activeSchedules"),
              value: d.schedules.filter((x) => x.active).length,
              icon: CalendarClock,
            },
            {
              label: t("detail.stats.attendance"),
              value:
                trend.rate !== null
                  ? f.percent(trend.rate)
                  : trend.averagePresent !== null
                    ? t("detail.stats.average", { count: trend.averagePresent })
                    : tcommon("dash"),
              icon: null,
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-1 px-4 py-4 ${i > 0 ? "sm:border-s" : ""} ${i % 2 === 1 ? "border-s sm:border-s" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""}`}
            >
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="font-heading text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex min-w-0 flex-col gap-10">
            <Section
              id="stages"
              title={ts("title")}
              description={d.stages.length > 0 ? t("detail.stages.description") : undefined}
              actions={
                <>
                  {d.stages.length > 0 ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/services/${service.id}/stages`}>
                        {t("detail.stages.manage")} <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  ) : null}
                  {can.structure && !service.archived ? (
                    <StageFormDialog serviceId={service.id} serviceName={service.name} />
                  ) : null}
                </>
              }
            >
              {d.stages.length === 0 ? (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Layers />
                    </EmptyMedia>
                    <EmptyTitle>{t("detail.stages.empty")}</EmptyTitle>
                    <EmptyDescription>
                      {t("detail.stages.emptyDescription", {
                        name: service.name,
                        count: d.stats.serviceLevelMembers,
                      })}
                    </EmptyDescription>
                  </EmptyHeader>
                  {can.structure && !service.archived ? (
                    <EmptyContent>
                      <StageFormDialog
                        serviceId={service.id}
                        serviceName={service.name}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Plus data-icon="inline-start" />
                            {t("detail.stages.addFirst")}
                          </Button>
                        }
                      />
                    </EmptyContent>
                  ) : null}
                </Empty>
              ) : (
                <ul className="divide-y border-y">
                  {d.stages.map((st) => (
                    <li key={st.id}>
                      <Link
                        href={`/services/${service.id}/stages/${st.id}`}
                        className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-2 py-3 hover:bg-muted/60 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,180px)]"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{st.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {tc("members", { count: st.members })} · {st.meets ?? ts("noSchedule")}
                          </span>
                        </span>
                        <span className="hidden text-sm text-muted-foreground md:block">
                          {st.next
                            ? t("detail.stages.next", {
                                day: f.relativeDayInline(st.next.date, today),
                                time: st.next.startTime,
                              })
                            : t("nothingPlanned")}
                        </span>
                        <span className="flex flex-col items-end gap-1.5">
                          {st.last && st.last.counts.rosterSize ? (
                            <>
                              <RosterCells
                                filled={st.last.counts.rosterPresent}
                                total={st.last.counts.rosterSize}
                                size="sm"
                                className="w-32"
                              />
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {lines.present(st.last)} · {f.relativeDay(st.last.date, today)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("detail.stages.noAttendance")}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {d.archivedStages.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t.rich("detail.stages.archived", {
                    names: d.archivedStages.map((x) => x.name).join(listSeparator),
                    link: (chunks) => (
                      <Link
                        href={`/services/${service.id}/stages`}
                        className="underline underline-offset-4"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              ) : null}
            </Section>

            <Section
              id="schedules"
              title={t("detail.schedules.title")}
              description={t("detail.schedules.description")}
            >
              <ScheduleList
                schedules={d.schedules}
                today={today}
                showService={false}
                emptyText={t("detail.schedules.empty")}
              />
            </Section>

            <Section id="recent" title={t("detail.recent.title")}>
              {d.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("detail.recent.empty")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {d.recent.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={sessionHref(s)}
                        className="-mx-2 flex items-center gap-4 px-2 py-3 hover:bg-muted/60"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{s.group}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {f.relativeDay(s.date, today)} · {s.title}
                          </span>
                        </span>
                        {s.counts.rosterSize ? (
                          <RosterCells
                            filled={s.counts.rosterPresent}
                            total={s.counts.rosterSize}
                            size="sm"
                            className="hidden w-32 sm:grid"
                          />
                        ) : null}
                        <span className="w-36 shrink-0 text-end text-sm tabular-nums">
                          {lines.present(s)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-10">
            <Section id="upcoming" title={t("detail.upcoming.title")}>
              {d.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("detail.upcoming.empty")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {d.upcoming.map((item) => (
                    <li key={item.kind === "session" ? item.id : item.key}>
                      <AgendaRow
                        compact
                        item={item}
                        today={today}
                        href={
                          item.kind === "session"
                            ? `/meetings/sessions/${item.id}`
                            : `/meetings/schedules/${item.scheduleId}`
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section
              id="team"
              title={t("detail.team.title")}
              actions={
                can.roles && d.team.length > 0 ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings#users">
                      {t("detail.team.manageRoles")} <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                ) : null
              }
            >
              {d.team.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("detail.team.empty")}
                  {can.roles ? (
                    <>
                      {" "}
                      {t.rich("detail.team.giveRole", {
                        link: (chunks) => (
                          <Link href="/settings#users" className="underline underline-offset-4">
                            {chunks}
                          </Link>
                        ),
                      })}
                    </>
                  ) : null}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {d.team.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{u.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {u.roles
                          .map((r) => (r.stage ? `${tr(r.role)} · ${r.stage}` : tr(r.role)))
                          .join(listSeparator)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  )
}
