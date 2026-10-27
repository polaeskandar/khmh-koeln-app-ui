import { CalendarOff } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { AgendaRow, sessionHref } from "@/components/session-bits"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { DayStrip, MeetingsTabs } from "@/features/meetings/day-strip"
import { OneOffSessionDialog } from "@/features/meetings/one-off-dialog"
import { ServiceFilter } from "@/features/meetings/service-filter"
import { getFormat } from "@/i18n/server"
import type { LocalDate } from "@/lib/domain/types"
import type { AgendaItem } from "@/lib/view-models"
import { formServices, getAgenda } from "@/server/queries/meetings"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("meetings") }
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined)

function itemHref(item: AgendaItem) {
  if (item.kind === "planned") return `/meetings/schedules/${item.scheduleId}`
  return item.status === "active" || item.status === "completed"
    ? sessionHref(item)
    : `/meetings/sessions/${item.id}`
}

export default async function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  const sp = await searchParams
  const ctx = await getStaffContext()
  const d = await getAgenda(ctx, { date: one(sp.date), service: one(sp.service) })
  const [t, tn, f] = await Promise.all([
    getTranslations("meetings"),
    getTranslations("nav"),
    getFormat(),
  ])
  const day = d.days.find((x) => x.date === d.selected)!
  const href = (date: LocalDate) => {
    const q = new URLSearchParams()
    if (date !== d.today) q.set("date", date)
    if (d.serviceId) q.set("service", d.serviceId)
    const s = q.toString()
    return s ? `/meetings?${s}` : "/meetings"
  }

  /** "3 meetings · 1 taking attendance · 1 canceled": one summary per state, as a list. */
  function daySummary(items: AgendaItem[]) {
    if (items.length === 0) return t("agenda.none")
    const canceled = items.filter((i) => i.kind === "session" && i.status === "canceled").length
    const open = items.filter((i) => i.kind === "session" && i.status === "active").length
    const planned = items.filter((i) => i.kind === "planned").length
    return [
      t("agenda.count", { count: items.length }),
      open ? t("agenda.open", { count: open }) : null,
      canceled ? t("agenda.canceled", { count: canceled }) : null,
      planned ? t("agenda.planned", { count: planned }) : null,
    ]
      .filter(Boolean)
      .join(" · ")
  }

  return (
    <>
      <Topbar crumbs={[{ label: tn("meetings") }]} />
      <PageBody>
        <PageHeader
          title={tn("meetings")}
          description={t("agenda.description")}
          actions={
            d.canCreateOneOff ? (
              <OneOffSessionDialog services={formServices(ctx)} today={d.today} />
            ) : null
          }
        />
        <MeetingsTabs active="sessions" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("agenda.range", {
                // "Monday 2 November to Sunday 15 November 2026": the year once, at the end.
                from: f.longDate(d.days[0].date).replace(/ \d{4}$/, ""),
                to: f.longDate(d.days.at(-1)!.date),
              })}
            </p>
            <ServiceFilter
              services={d.services}
              value={d.serviceId}
              basePath="/meetings"
              params={{ date: d.selected !== d.today ? d.selected : null }}
            />
          </div>
          <DayStrip
            days={d.days.map((x) => ({ date: x.date, tones: x.tones, count: x.items.length }))}
            selected={d.selected}
            today={d.today}
            href={href}
          />
        </div>
        <Section id="day" title={f.longDate(d.selected)} description={daySummary(day.items)}>
          {day.items.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarOff />
                </EmptyMedia>
                <EmptyTitle>{t("agenda.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {d.serviceId ? t("agenda.emptyFiltered") : t("agenda.emptyOtherDay")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y border-y">
              {day.items.map((item) => (
                <li key={item.kind === "session" ? item.id : item.key}>
                  <AgendaRow item={item} today={d.today} href={itemHref(item)} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </>
  )
}
