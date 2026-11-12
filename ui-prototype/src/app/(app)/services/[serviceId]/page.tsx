import Link from "next/link"
import { ArrowRight, CalendarDays, CalendarX2, Layers, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { PageHeader, Section } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { DraftBadge, StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { ruleSummary } from "@/features/schedule/rule-summary"
import { UnitSchedule, YearSwitch } from "@/features/schedule/unit-schedule"
import { AddStageButton, ServiceActions, StageActions } from "@/features/services/service-actions"
import { getFormat } from "@/i18n/server"
import { getScheduleOverview, getService } from "@/server/queries/services"
import { getUnitSchedule, planningYearOptions, unitFor } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

function yearOf(value: string | string[] | undefined) {
  const years = planningYearOptions()
  const year = Number(value)

  return years.includes(year) ? year : years[0]
}

export default async function ServicePage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]">) {
  const { serviceId } = await params
  const query = await searchParams
  const ctx = await getStaffContext()
  const service = getService(ctx, serviceId)
  const staged = service.structure === "stages"
  const tab = staged && query.tab !== "schedule" ? "stages" : "schedule"
  const year = yearOf(query.year)
  const t = await getTranslations("services")
  const ts = await getTranslations("schedule")
  const f = await getFormat()
  const base = `/services/${service.id}`
  const activeStages = service.stages.filter((x) => !x.archived)
  const archivedStages = service.stages.filter((x) => x.archived)
  const daysOffLink = (
    <Button asChild variant="outline" size="sm">
      <Link href={`${base}/days?year=${year}`}>
        <CalendarX2 data-icon="inline-start" />
        {t("daysOff")}
      </Link>
    </Button>
  )

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/services" }, { label: service.name }]} />
      <PageBody>
        <PageHeader
          title={service.name}
          description={service.description}
          meta={
            <>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <ServiceSwatch tone={service.tone} />
                {staged ? t("withStages") : t("withoutStages")}
              </span>
              {service.archived ? (
                <StatusBadge tone="muted">{t("archivedBadge")}</StatusBadge>
              ) : null}
            </>
          }
          actions={service.can.manage ? <ServiceActions service={service} /> : null}
        />
        {staged ? (
          <LinkTabs
            label={service.name}
            active={tab}
            items={[
              { key: "stages", href: base, label: t("tabs.stages"), count: activeStages.length },
              {
                key: "schedule",
                href: `${base}?tab=schedule&year=${year}`,
                label: t("tabs.schedule"),
              },
            ]}
          />
        ) : null}
        {tab === "stages" ? (
          <Section
            title={t("tabs.stages")}
            description={t("stagesHint")}
            actions={service.can.stages ? <AddStageButton serviceId={service.id} /> : null}
          >
            <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeStages.map((stage, index) => (
                <li key={stage.id} className="flex flex-col gap-3 border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center bg-muted font-heading text-sm font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        href={`${base}/stages/${stage.id}`}
                        className="font-heading text-base font-semibold underline-offset-4 hover:underline"
                      >
                        {stage.name}
                      </Link>
                      {stage.description ? (
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      ) : null}
                    </div>
                    {service.can.stages ? (
                      <StageActions
                        stage={stage}
                        first={index === 0}
                        last={index === activeStages.length - 1}
                      />
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound className="size-3.5" aria-hidden="true" />
                      {t("members", { count: stage.members })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {stage.next
                        ? t("next", {
                            when: `${f.dayMonth(stage.next.date)}, ${stage.next.startTime}`,
                          })
                        : t("noNext")}
                    </span>
                    <Link
                      href={`${base}/stages/${stage.id}`}
                      className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {t("openSchedule")}
                      <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            {activeStages.length === 0 ? (
              <p className="border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t("noStagesYet")}
              </p>
            ) : null}
            {archivedStages.length > 0 ? (
              <div className="flex flex-col gap-2 pt-2">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("archivedStages")}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {archivedStages.map((stage) => (
                    <li
                      key={stage.id}
                      className="flex items-center gap-1 border px-3 py-1 text-sm text-muted-foreground"
                    >
                      {stage.name}
                      {service.can.stages ? <StageActions stage={stage} first last /> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        ) : staged ? (
          <Section
            title={ts("overview.title", { year: String(year) })}
            description={ts("overview.hint")}
            actions={daysOffLink}
          >
            {(() => {
              const overview = getScheduleOverview(ctx, service.id, year)
              const open = overview.filter((u) => u.status !== "confirmed" && u.canManage)

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <YearSwitch
                      years={planningYearOptions()}
                      year={year}
                      href={(y) => `${base}?tab=schedule&year=${y}`}
                    />
                    {open.length > 0 ? (
                      <Button asChild>
                        <Link href={`${base}/plan?year=${year}`}>
                          {ts("overview.prepareAll", { year: String(year), count: open.length })}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <ul className="divide-y border">
                    {overview.map((u) => (
                      <li
                        key={u.scheduleId}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                      >
                        <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                          <Link
                            href={`${base}/stages/${u.unit.stageId}?year=${year}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {u.unit.stageName}
                          </Link>
                          <span className="text-sm text-muted-foreground">
                            {u.rule ? ruleSummary(f, u.rule) : ts("overview.noRule")}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {u.status === "confirmed"
                            ? ts("overview.counts", { count: u.sessions, canceled: u.canceled })
                            : null}
                        </span>
                        <span className={cn("w-32 text-end")}>
                          {u.status === "confirmed" ? (
                            <StatusBadge tone="success">{ts("status.confirmed")}</StatusBadge>
                          ) : u.status === "draft" ? (
                            <DraftBadge />
                          ) : (
                            <StatusBadge tone="muted" dashed>
                              {ts("status.none")}
                            </StatusBadge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {overview.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Layers className="size-4" />
                      {t("noStagesYet")}
                    </p>
                  ) : null}
                </div>
              )
            })()}
          </Section>
        ) : (
          <Section title={t("tabs.schedule")} description={ts("year.hint")} actions={daysOffLink}>
            <UnitSchedule
              data={getUnitSchedule(ctx, unitFor(ctx, service.id, null), year)}
              hrefFor={(y) => `${base}?year=${y}`}
              planHref={`${base}/plan?year=${year}`}
            />
          </Section>
        )}
      </PageBody>
    </>
  )
}
