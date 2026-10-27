import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { Section } from "@/components/page-header"
import { AgendaRow, sessionHref } from "@/components/session-bits"
import { ScheduleList } from "@/features/meetings/schedule-list"
import { ScheduleDialog } from "@/features/meetings/schedule-dialog"
import { StageHeader } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { today as clockToday } from "@/server/mock/clock"
import { formServices } from "@/server/queries/meetings"
import { getStageHeader, getStageMeetings } from "@/server/queries/stage"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("meetings")
  return { title: t("stage.pageTitle") }
}

export default async function StageMeetingsPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/meetings">) {
  const { serviceId, stageId } = await params
  const ctx = await getStaffContext()
  const h = await getStageHeader(ctx, serviceId, stageId)
  if (!h) notFound()
  const d = await getStageMeetings(ctx, serviceId, stageId)
  const t = await getTranslations("meetings")
  const today = clockToday()
  return (
    <>
      <StageCrumbsTopbar h={h} tab="meetings" />
      <PageBody>
        <StageHeader h={h} active="meetings" />
        <Section
          id="schedules"
          title={t("tabs.schedules")}
          description={t("stage.schedulesDescription")}
          actions={
            h.can.sessions && !h.stage.archived ? (
              <ScheduleDialog
                services={formServices(ctx)}
                today={today}
                fixedServiceId={serviceId}
                fixedStageId={stageId}
              />
            ) : null
          }
        >
          <ScheduleList
            schedules={d.schedules}
            today={today}
            showService={false}
            emptyText={t("stage.noSchedule")}
          />
        </Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <Section
            id="upcoming"
            title={t("stage.upcomingTitle")}
            description={t("stage.upcomingDescription")}
          >
            {d.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stage.nothingPlanned")}</p>
            ) : (
              <ul className="divide-y border-y">
                {d.upcoming.map((item) => (
                  <li key={item.kind === "session" ? item.id : item.key}>
                    <AgendaRow
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
                      href={s.status === "canceled" ? `/meetings/sessions/${s.id}` : sessionHref(s)}
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
