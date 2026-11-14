import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { RoleForm } from "@/features/access/role-form"
import { getRoleForm } from "@/server/queries/access"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("access.editor"))("newTitle") }
}

export default async function NewRolePage() {
  const data = getRoleForm(await getStaffContext(), null)
  const t = await getTranslations("access")
  const tn = await getTranslations("nav")

  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("administration") },
          { label: t("title"), href: "/admin/access?tab=roles" },
          { label: t("editor.newTitle") },
        ]}
      />
      <PageBody>
        <PageHeader title={t("editor.newTitle")} description={t("editor.newHint")} />
        <RoleForm data={data} />
      </PageBody>
    </>
  )
}
