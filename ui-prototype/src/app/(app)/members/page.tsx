import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { AddPersonDialog, MembersTable } from "@/features/members/members-table"
import { listMembers } from "@/server/queries/members"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("members") }
}

export default async function MembersPage() {
  const d = await listMembers(await getStaffContext())
  const [t, tn] = await Promise.all([getTranslations("members"), getTranslations("nav")])
  return (
    <>
      <Topbar crumbs={[{ label: tn("members") }]} />
      <PageBody>
        <PageHeader
          title={tn("members")}
          description={t("description")}
          actions={d.canAdd ? <AddPersonDialog services={d.services} /> : null}
        />
        <MembersTable data={d} />
      </PageBody>
    </>
  )
}
