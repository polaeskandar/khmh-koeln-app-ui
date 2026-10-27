import { notFound } from "next/navigation"
import { Info } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { StageFormDialog } from "@/features/stages/stage-dialogs"
import { StagesManager } from "@/features/stages/stages-manager"
import { getStageManagement } from "@/server/queries/services"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("stages")
  return { title: t("title") }
}

export default async function StagesPage({ params }: PageProps<"/services/[serviceId]/stages">) {
  const { serviceId } = await params
  const d = await getStageManagement(await getStaffContext(), serviceId)
  if (!d) notFound()
  const [t, tn] = await Promise.all([getTranslations("stages"), getTranslations("nav")])
  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("services"), href: "/services" },
          { label: d.service.name, href: `/services/${d.service.id}` },
          { label: t("title") },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("page.title", { name: d.service.name })}
          description={t("page.description")}
          actions={
            d.can.structure ? (
              <StageFormDialog serviceId={d.service.id} serviceName={d.service.name} />
            ) : null
          }
        />
        {d.can.structure && d.stages.length > 1 ? (
          <p className="-mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {t("page.hint")}
          </p>
        ) : null}
        <StagesManager
          service={d.service}
          stages={d.stages}
          archived={d.archived}
          canManage={d.can.structure}
        />
        {d.serviceLevelMembers > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("page.withoutStage", { count: d.serviceLevelMembers, name: d.service.name })}
          </p>
        ) : null}
      </PageBody>
    </>
  )
}
