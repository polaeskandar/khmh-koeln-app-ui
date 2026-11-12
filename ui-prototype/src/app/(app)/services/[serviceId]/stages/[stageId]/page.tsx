import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { UnitSchedule } from "@/features/schedule/unit-schedule"
import { getUnitSchedule, planningYearOptions, unitFor } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

export default async function StagePage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/stages/[stageId]">) {
  const { serviceId, stageId } = await params
  const query = await searchParams
  const ctx = await getStaffContext()
  const unit = unitFor(ctx, serviceId, stageId)
  const years = planningYearOptions()
  const year = years.includes(Number(query.year)) ? Number(query.year) : years[0]
  const data = getUnitSchedule(ctx, unit, year)
  const t = await getTranslations("services")
  const base = `/services/${serviceId}/stages/${stageId}`

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("title"), href: "/services" },
          { label: data.unit.serviceName, href: `/services/${serviceId}` },
          { label: data.unit.stageName ?? "" },
        ]}
      />
      <PageBody>
        <PageHeader
          title={data.unit.name}
          description={t("stageScheduleHint")}
          meta={
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ServiceSwatch tone={data.unit.tone} />
              {t("schedule")}
            </span>
          }
        />
        <UnitSchedule
          data={data}
          hrefFor={(y) => `${base}?year=${y}`}
          planHref={`${base}/plan?year=${year}`}
        />
      </PageBody>
    </>
  )
}
