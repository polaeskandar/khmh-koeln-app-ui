import Link from "next/link"
import { notFound } from "next/navigation"
import { CirclePause } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { AgendaRow, sessionHref } from "@/components/session-bits"
import { ServiceTag } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { ScheduleActions } from "@/features/meetings/schedule-actions"
import { rosterLabel } from "@/features/meetings/schedule-list"
import { OccurrenceMenu } from "@/features/meetings/session-dialogs"
import { getFormat } from "@/i18n/server"
import { today as clockToday } from "@/server/mock/clock"
import { formServices, getScheduleDetail } from "@/server/queries/meetings"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("meetings")
  return { title: t("schedule.pageTitle") }
}

export default async function SchedulePage({
  params,
}: PageProps<"/meetings/schedules/[scheduleId]">) {
  const { scheduleId } = await params
  const ctx = await getStaffContext()
  const d = await getScheduleDetail(ctx, scheduleId)
  if (!d) notFound()
  const [t, tn, f] = await Promise.all([
    getTranslations("meetings"),
    getTranslations("nav"),
    getFormat(),
  ])
  const today = clockToday()
  const sch = d.schedule
  // Why the schedule can't be activated: its service or its stage is archived.
  const archived = d.serviceArchived
    ? { name: sch.service.name, restore: t("schedule.restoreService", { name: sch.service.name }) }
    : d.stageArchived && sch.stage
      ? { name: sch.stage.name, restore: t("schedule.restoreStage", { name: sch.stage.name }) }
      : null
  const blocked = archived ? t("schedule.archived", { name: archived.name }) : null
  const pattern = f.recurrence(sch.recurrence)
  const time = f.timeRange(sch.startTime, sch.endTime)
  const groupHref = sch.stage
    ? `/services/${sch.service.id}/stages/${sch.stage.id}`
    : `/services/${sch.service.id}`

  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("meetings"), href: "/meetings" },
          { label: t("tabs.schedules"), href: "/meetings/schedules" },
          { label: `${sch.group} · ${sch.name}` },
        ]}
      />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={sch.service} />
              <span className="text-muted-foreground">·</span>
              <Link
                href={groupHref}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                {sch.group}
              </Link>
              {!sch.active ? (
                <StatusBadge tone="muted" icon={CirclePause}>
                  {t("list.inactive")}
                </StatusBadge>
              ) : null}
            </>
          }
          title={sch.name}
          description={[t("schedule.when", { pattern, time }), sch.location, rosterLabel(t, sch)]
            .filter(Boolean)
            .join(" · ")}
          actions={
            sch.can.manage ? (
              <ScheduleActions
                schedule={sch}
                services={formServices(ctx)}
                today={today}
                blocked={blocked}
              />
            ) : null
          }
        />

        {!sch.active ? (
          <p className="border border-dashed p-4 text-sm text-muted-foreground">
            {t("schedule.inactiveNote")}
            {archived ? ` ${archived.restore}` : ""}
          </p>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-10">
            <Section
              id="next"
              title={t("schedule.nextTitle")}
              description={t("schedule.nextDescription")}
            >
              {d.next.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {sch.active ? t("schedule.nextEmpty") : t("schedule.nextInactive")}
                </p>
              ) : (
                <ul className="divide-y border-y">
                  {d.next.map((item) =>
                    item.kind === "planned" ? (
                      <li key={item.key} className="flex items-center gap-2">
                        <AgendaRow item={item} today={today} className="flex-1" />
                        {item.can.manage ? (
                          <OccurrenceMenu
                            scheduleId={sch.id}
                            group={sch.group}
                            times={{
                              date: item.date,
                              startTime: item.startTime,
                              endTime: item.endTime,
                            }}
                          />
                        ) : null}
                      </li>
                    ) : (
                      <li key={item.id}>
                        <AgendaRow
                          item={item}
                          today={today}
                          href={
                            item.status === "active"
                              ? sessionHref(item)
                              : `/meetings/sessions/${item.id}`
                          }
                        />
                      </li>
                    )
                  )}
                </ul>
              )}
            </Section>

            <Section id="past" title={t("schedule.pastTitle")}>
              {d.past.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("schedule.pastEmpty")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {d.past.map((s) => (
                    <li key={s.id}>
                      <AgendaRow
                        item={s}
                        today={today}
                        href={
                          s.status === "completed" ? sessionHref(s) : `/meetings/sessions/${s.id}`
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border p-5 text-sm">
              <dt className="text-muted-foreground">{t("schedule.repeats")}</dt>
              <dd>{pattern}</dd>
              <dt className="text-muted-foreground">{t("schedule.time")}</dt>
              <dd className="tabular-nums">{time}</dd>
              <dt className="text-muted-foreground">{t("fields.place")}</dt>
              <dd>{sch.location ?? t("schedule.notSet")}</dd>
              <dt className="text-muted-foreground">{t("schedule.who")}</dt>
              <dd>
                {sch.rosterMode === "open"
                  ? t("roster.open")
                  : t("schedule.members", { group: sch.group, count: d.rosterSize ?? 0 })}
              </dd>
              <dt className="text-muted-foreground">{t("schedule.sessions")}</dt>
              <dd>{d.generating ? t("schedule.generating") : t("schedule.notGenerating")}</dd>
              <dt className="text-muted-foreground">{t("schedule.created")}</dt>
              <dd>{f.instantLabel(d.createdAt, today)}</dd>
              <dt className="text-muted-foreground">{t("schedule.updated")}</dt>
              <dd>{f.instantLabel(d.updatedAt, today)}</dd>
            </dl>
            {sch.description ? (
              <p dir="auto" className="text-sm text-muted-foreground">
                {sch.description}
              </p>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  )
}
