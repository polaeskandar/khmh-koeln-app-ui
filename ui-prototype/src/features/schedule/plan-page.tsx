import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import type { Uuid } from "@/lib/domain/types"
import { getPlanEditor, unitFor } from "@/server/queries/schedule"
import { getStaffContext } from "@/server/request"

import { PlanEditor } from "./plan-editor"

export async function PlanPage({
  serviceId,
  stageId,
  year,
}: {
  serviceId: Uuid
  stageId: Uuid | null
  year: number
}) {
  const ctx = await getStaffContext()
  const data = getPlanEditor(ctx, unitFor(ctx, serviceId, stageId), year)
  const service = `/services/${serviceId}`
  const returnTo =
    stageId === null ? `${service}?year=${year}` : `${service}/stages/${stageId}?year=${year}`

  if (data === null) {
    redirect(returnTo)
  }

  const t = await getTranslations("schedule.editor")
  const ts = await getTranslations("services")

  return (
    <>
      <Topbar
        crumbs={[
          { label: ts("title"), href: "/services" },
          { label: data.unit.serviceName, href: service },
          ...(data.unit.stageName === null ? [] : [{ label: data.unit.stageName, href: returnTo }]),
          { label: t("crumb", { year: String(year) }) },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("title", { name: data.unit.name, year: String(year) })}
          description={t("description")}
        />
        <PlanEditor
          unit={data.unit}
          scheduleId={data.scheduleId}
          version={data.version}
          year={year}
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
