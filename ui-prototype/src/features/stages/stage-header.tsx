import { Archive, MapPin, Repeat, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"

import type { Crumb } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { PageHeader } from "@/components/page-header"
import { ServiceTag } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import type { StageHeader as StageHeaderData } from "@/server/queries/stage"

import { StageActionsMenu } from "./stage-dialogs"

export type StageTab = "overview" | "meetings" | "attendance" | "lessons" | "homework"

/** The names of a stage's tabs in the current language; they are also its breadcrumbs. */
function useTabLabels(): Record<StageTab, string> {
  const t = useTranslations("stages.tabs")
  const tn = useTranslations("nav")
  return {
    overview: t("overview"),
    meetings: tn("meetings"),
    attendance: tn("attendance"),
    lessons: t("lessons"),
    homework: t("homework"),
  }
}

/** Enough of a stage to link to it and name it in breadcrumbs. */
export type StageLink = {
  service: { id: string; name: string }
  stage: { id: string; name: string }
}

export function stageBase(h: StageLink) {
  return `/services/${h.service.id}/stages/${h.stage.id}`
}

/**
 * Breadcrumbs: Services › Sunday School › Stages › 3rd Class › Lessons › …
 * A hook because the crumbs are translated; works in client components and in
 * server components that are not async.
 */
export function useStageCrumbs(h: StageLink, tab: StageTab, extra: Crumb[] = []): Crumb[] {
  const tn = useTranslations("nav")
  const t = useTranslations("stages")
  const tabs = useTabLabels()
  const base = stageBase(h)
  const crumbs: Crumb[] = [
    { label: tn("services"), href: "/services" },
    { label: h.service.name, href: `/services/${h.service.id}` },
    { label: t("title"), href: `/services/${h.service.id}/stages` },
    { label: h.stage.name, href: base },
  ]
  if (tab !== "overview") crumbs.push({ label: tabs[tab], href: `${base}/${tab}` })
  return [...crumbs, ...extra]
}

/** Stage context and its tabs: Overview, Meetings, Attendance, Lessons, Homework. */
export function StageHeader({ h, active }: { h: StageHeaderData; active: StageTab }) {
  const t = useTranslations("stages")
  const tc = useTranslations("counts")
  const tcommon = useTranslations("common")
  const f = useFormat()
  const tabs = useTabLabels()
  const base = stageBase(h)
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        meta={
          <>
            <ServiceTag service={h.service} />
            <span className="text-muted-foreground">· {t("kind")}</span>
            {h.stage.archived ? (
              <StatusBadge tone="muted" icon={Archive}>
                {tcommon("archived")}
              </StatusBadge>
            ) : null}
          </>
        }
        title={h.stage.name}
        actions={
          h.can.structure ? (
            <StageActionsMenu
              serviceId={h.service.id}
              serviceName={h.service.name}
              stage={{ id: h.stage.id, name: h.stage.name, description: h.stage.description }}
              archived={h.stage.archived}
              members={h.impact.members}
              sessions={h.impact.sessions}
              deleteBlocker={h.impact.deleteBlocker}
              afterDelete={`/services/${h.service.id}/stages`}
              variant="button"
            />
          ) : null
        }
      >
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UsersRound className="size-3.5" aria-hidden="true" />
            {tc("members", { count: h.members })}
          </span>
          {h.meets ? (
            <span className="inline-flex items-center gap-1.5">
              <Repeat className="size-3.5" aria-hidden="true" />
              {t("meets", { pattern: h.meets.pattern, time: h.meets.time })}
            </span>
          ) : null}
          {h.meets?.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {h.meets.location}
            </span>
          ) : null}
          {h.servants.length > 0 ? (
            <span>
              {t("servants", {
                names: h.servants
                  .map((u) => (u.leader ? t("leader", { name: u.name }) : u.name))
                  .join(f.locale === "ar" ? "، " : ", "),
              })}
            </span>
          ) : null}
        </p>
      </PageHeader>
      <LinkTabs
        label={t("sections", { name: h.stage.name })}
        active={active}
        items={[
          { key: "overview", label: tabs.overview, href: base },
          { key: "meetings", label: tabs.meetings, href: `${base}/meetings` },
          { key: "attendance", label: tabs.attendance, href: `${base}/attendance` },
          {
            key: "lessons",
            label: tabs.lessons,
            href: `${base}/lessons`,
            count: h.counts.upcomingLessons,
          },
          {
            key: "homework",
            label: tabs.homework,
            href: `${base}/homework`,
            count: h.counts.openHomework,
          },
        ]}
      />
    </div>
  )
}
