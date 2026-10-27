import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { ServiceTag } from "@/components/service-tag"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { MeetingsTabs } from "@/features/meetings/day-strip"
import { ScheduleList } from "@/features/meetings/schedule-list"
import { ScheduleDialog } from "@/features/meetings/schedule-dialog"
import { ServiceFilter } from "@/features/meetings/service-filter"
import { today as clockToday } from "@/server/mock/clock"
import { formServices, listSchedules } from "@/server/queries/meetings"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("meetings")
  return { title: t("schedules.pageTitle") }
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined)

export default async function SchedulesPage({ searchParams }: PageProps<"/meetings/schedules">) {
  const sp = await searchParams
  const ctx = await getStaffContext()
  const d = await listSchedules(ctx, { service: one(sp.service), status: one(sp.status) })
  const [t, tn] = await Promise.all([getTranslations("meetings"), getTranslations("nav")])
  const today = clockToday()
  const statusHref = (status: string) => {
    const q = new URLSearchParams()
    if (status !== "active") q.set("status", status)
    if (d.serviceId) q.set("service", d.serviceId)
    const s = q.toString()
    return s ? `/meetings/schedules?${s}` : "/meetings/schedules"
  }
  const tabs = [
    { key: "active", label: t("schedules.active", { count: d.counts.active }) },
    { key: "inactive", label: t("schedules.inactive", { count: d.counts.inactive }) },
    { key: "all", label: t("schedules.all") },
  ]
  return (
    <>
      <Topbar
        crumbs={[{ label: tn("meetings"), href: "/meetings" }, { label: t("tabs.schedules") }]}
      />
      <PageBody>
        <PageHeader
          title={tn("meetings")}
          description={t("schedules.description")}
          actions={
            d.canCreate ? <ScheduleDialog services={formServices(ctx)} today={today} /> : null
          }
        />
        <MeetingsTabs active="schedules" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label={t("schedules.statusNav")}
            className="inline-flex h-9 w-fit items-center bg-muted p-1"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={statusHref(tab.key)}
                aria-current={d.status === tab.key ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
                  d.status === tab.key && "bg-background text-foreground shadow-xs"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <ServiceFilter
            services={d.services}
            value={d.serviceId}
            basePath="/meetings/schedules"
            params={{ status: d.status !== "active" ? d.status : null }}
          />
        </div>

        {d.groups.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock />
              </EmptyMedia>
              <EmptyTitle>
                {d.status === "inactive"
                  ? t("schedules.emptyInactiveTitle")
                  : t("schedules.emptyTitle")}
              </EmptyTitle>
              <EmptyDescription>
                {d.status === "inactive"
                  ? t("schedules.emptyInactiveDescription")
                  : t("schedules.emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-10">
            {d.groups.map((g) => (
              <section
                key={g.service.id}
                className="flex flex-col gap-3"
                aria-label={g.service.name}
              >
                <h2 className="font-heading text-base font-semibold tracking-tight">
                  <ServiceTag service={g.service} className="text-base text-foreground" />
                </h2>
                <ScheduleList
                  schedules={g.schedules}
                  today={today}
                  showService={false}
                  emptyText={t("schedules.emptyService")}
                />
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
