import { AlertTriangle } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { DaysOffEditor } from "@/features/calendar/days-off-editor"
import { YearSwitch } from "@/features/schedule/unit-schedule"
import { getFormat } from "@/i18n/server"
import { getDaysOff } from "@/server/queries/calendar"
import { planningYearOptions } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

export default async function DaysOffPage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/days">) {
  const { serviceId } = await params
  const query = await searchParams
  const years = planningYearOptions()
  const year = years.includes(Number(query.year)) ? Number(query.year) : years[1]
  const data = getDaysOff(await getStaffContext(), serviceId, year)
  const t = await getTranslations("daysOff")
  const ts = await getTranslations("services")
  const f = await getFormat()

  return (
    <>
      <Topbar
        crumbs={[
          { label: ts("title"), href: "/services" },
          { label: data.service.name, href: `/services/${serviceId}?tab=schedule&year=${year}` },
          { label: t("crumb", { year: String(year) }) },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("title", { year: String(year) })}
          description={t("description")}
          meta={
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ServiceSwatch tone={data.service.tone} />
              {data.service.name}
            </span>
          }
        />
        <YearSwitch
          years={data.years}
          year={year}
          href={(y) => `/services/${serviceId}/days?year=${y}`}
        />
        {data.unverified ? (
          <p className="flex items-start gap-2 border border-warning/40 bg-warning-soft/40 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t("unverified", { year: String(year) })}
          </p>
        ) : null}
        <DaysOffEditor
          serviceId={serviceId}
          year={year}
          mode={data.mode}
          marks={data.marks}
          feasts={data.feasts}
          meetings={data.meetings}
          today={data.today}
          canManage={data.canManage}
        />
        <Section title={t("listTitle", { count: data.list.length })} description={t("listHint")}>
          <ul className="divide-y border">
            {data.list.map((d) => (
              <li
                key={d.date}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
              >
                <span className="w-32 tabular-nums">{f.dayMonth(d.date)}</span>
                <span className="flex-1 font-medium">{d.label}</span>
                {d.kind === "locked" ? (
                  <StatusBadge tone="danger">{t("locked")}</StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </>
  )
}
