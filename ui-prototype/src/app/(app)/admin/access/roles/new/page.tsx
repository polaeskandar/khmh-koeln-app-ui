import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { RoleEditor } from "@/features/access/role-editor"
import { getRole } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

export default async function NewRolePage() {
  getRole(await getStaffContext(), null)
  const t = await getTranslations("access")

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/admin/access" }, { label: t("roles.new") }]} />
      <PageBody>
        <PageHeader title={t("roles.new")} description={t("editor.hint")} />
        <RoleEditor role={null} />
      </PageBody>
    </>
  )
}
