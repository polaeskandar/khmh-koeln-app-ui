import Link from "next/link"
import { BadgeCheck, Church, CircleAlert } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { useOccasionName } from "@/components/session-card"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { YearCalendar } from "@/components/year-calendar"
import {
  AddEventDialog,
  RemoveEventButton,
  VerifyYearButton,
} from "@/features/calendar/calendar-actions"
import { YearSwitch } from "@/features/schedule/unit-schedule"
import { getFormat } from "@/i18n/server"
import { getCalendar } from "@/server/queries/calendar"
import { planningYearOptions } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

function OccasionName({ occasion }: { occasion: { key: string | null; name: string | null } }) {
  const name = useOccasionName()

  return <>{name(occasion)}</>
}

export default async function CalendarPage({ searchParams }: PageProps<"/services/calendar">) {
  const query = await searchParams
  const years = planningYearOptions()
  const year = years.includes(Number(query.year)) ? Number(query.year) : years[1]
  const data = getCalendar(await getStaffContext(), year)
  const t = await getTranslations("calendar")
  const tc = await getTranslations("occasionCategories")
  const tn = await getTranslations("services")
  const f = await getFormat()

  return (
    <>
      <Topbar crumbs={[{ label: tn("title"), href: "/services" }, { label: t("title") }]} />
      <PageBody>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            data.canManage ? (
              <>
                <AddEventDialog year={year} services={data.services} />
                {data.unverified > 0 ? (
                  <VerifyYearButton year={year} count={data.unverified} />
                ) : null}
              </>
            ) : null
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <YearSwitch years={years} year={year} href={(y) => `/services/calendar?year=${y}`} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {data.unverified > 0 ? (
              <>
                <CircleAlert className="size-4 text-warning" aria-hidden="true" />
                {t("unverifiedCount", { count: data.unverified })}
              </>
            ) : (
              <>
                <BadgeCheck className="size-4 text-success" aria-hidden="true" />
                {data.verifiedBy ? t("verifiedBy", { name: data.verifiedBy.name }) : t("verified")}
              </>
            )}
          </p>
        </div>
        <p className="border-s-2 border-warning ps-3 text-sm text-pretty text-muted-foreground">
          {t("source")}
        </p>
        <YearCalendar
          year={year}
          marks={data.marks}
          feasts={data.feasts}
          meetings={[]}
          today={data.today}
        />
        <Section title={t("occasions", { year: String(year) })}>
          <ul className="divide-y border">
            {data.occasions.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="w-28 shrink-0 text-sm tabular-nums">{f.dayMonth(o.date)}</span>
                <span className="flex min-w-40 flex-1 items-center gap-2 text-sm font-medium">
                  {o.category === "churchEvent" ? (
                    <Church className="size-4 text-warning" aria-hidden="true" />
                  ) : null}
                  <OccasionName occasion={o} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.category === "churchEvent"
                    ? o.services.length > 0
                      ? f.list(o.services)
                      : t("allServices")
                    : tc(o.category)}
                </span>
                {o.mode === "mandatory" ? (
                  <StatusBadge tone="warning">{t("mandatory")}</StatusBadge>
                ) : null}
                {o.verified ? null : (
                  <StatusBadge tone="muted" dashed>
                    {t("notVerified")}
                  </StatusBadge>
                )}
                {data.canManage && o.source === "church" ? (
                  <RemoveEventButton id={o.id} name={o.name ?? ""} />
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t("perService")} description={t("perServiceHint")}>
          <ul className="divide-y border">
            {data.services.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex min-w-48 flex-1 items-center gap-2 font-medium">
                  <ServiceSwatch tone={x.tone} />
                  {x.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {x.mode === "custom"
                    ? t("custom", { count: x.count })
                    : t("automatic", { count: x.count })}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/services/${x.id}/days?year=${year}`}>{t("openDays")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </>
  )
}
