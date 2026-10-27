import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { ServiceFormDialog } from "@/features/services/service-dialogs"
import { ServicesTable } from "@/features/services/services-table"
import { today } from "@/server/mock/clock"
import { getStaffContext } from "@/server/request"
import { listServices } from "@/server/queries/services"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("services") }
}

export default async function ServicesPage() {
  const data = await listServices(await getStaffContext())
  const [t, tn] = await Promise.all([getTranslations("services"), getTranslations("nav")])
  return (
    <>
      <Topbar crumbs={[{ label: tn("services") }]} />
      <PageBody>
        <PageHeader
          title={tn("services")}
          description={t("description")}
          actions={data.canCreate ? <ServiceFormDialog /> : null}
        />
        <ServicesTable rows={data.rows} today={today()} />
      </PageBody>
    </>
  )
}
