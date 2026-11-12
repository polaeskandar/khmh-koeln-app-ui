import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { PlanEditor } from "@/features/schedule/plan-editor"
import { getPlanEditor } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

export default async function PlanPage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/plan">) {
  const { serviceId } = await params
  const query = await searchParams
  const stage = typeof query.stage === "string" ? [query.stage] : []
  const data = getPlanEditor(await getStaffContext(), serviceId, Number(query.year), stage)
  const t = await getTranslations("schedule.editor")
  const ts = await getTranslations("services")
  const returnTo =
    data.service.structure === "single" || stage.length === 0
      ? `/services/${serviceId}?tab=schedule&year=${data.year}`
      : `/services/${serviceId}/stages/${stage[0]}?year=${data.year}`

  return (
    <>
      <Topbar
        crumbs={[
          { label: ts("title"), href: "/services" },
          {
            label: data.service.name,
            href: `/services/${serviceId}?tab=schedule&year=${data.year}`,
          },
          { label: t("crumb", { year: String(data.year) }) },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("title", { name: data.service.name, year: String(data.year) })}
          description={t("description")}
        />
        <PlanEditor
          serviceName={data.service.name}
          year={data.year}
          units={data.units}
          rule={data.rule}
          decisions={data.decisions}
          hits={data.hits}
          unverified={data.unverified}
          canKeepMandatory={data.canKeepMandatory}
          returnTo={returnTo}
        />
      </PageBody>
    </>
  )
}
