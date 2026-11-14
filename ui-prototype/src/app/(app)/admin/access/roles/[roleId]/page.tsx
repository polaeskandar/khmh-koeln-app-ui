import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { RoleForm } from "@/features/access/role-form"
import { getRoleForm } from "@/server/queries/access"
import { getStaffContext } from "@/server/request"

export default async function EditRolePage({ params }: PageProps<"/admin/access/roles/[roleId]">) {
  const { roleId } = await params
  const data = getRoleForm(await getStaffContext(), roleId)
  const t = await getTranslations("access")
  const tn = await getTranslations("nav")
  const title = t("editor.editTitle", { name: data.role!.name })

  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("administration") },
          { label: t("title"), href: `/admin/access?tab=roles&role=${roleId}` },
          { label: data.role!.name },
        ]}
      />
      <PageBody>
        <PageHeader title={title} description={t("editor.editHint")} />
        <RoleForm data={data} />
      </PageBody>
    </>
  )
}
