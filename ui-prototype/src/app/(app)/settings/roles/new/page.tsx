import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { RoleEditor } from "@/features/settings/role-editor"
import { getRoleEditor } from "@/server/queries/roles"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("roleEditor")
  return { title: t("titleNew") }
}

/** A new role: its name and what it allows. It is given to accounts afterwards. */
export default async function NewRolePage() {
  const ctx = await getStaffContext()
  const [d, t, tn] = await Promise.all([
    getRoleEditor(ctx, null),
    getTranslations("roleEditor"),
    getTranslations("nav"),
  ])
  const crumbs = [
    { label: tn("settings"), href: "/settings" },
    { label: t("roles"), href: "/settings#roles" },
  ]
  if (!d) {
    return (
      <>
        <Topbar crumbs={crumbs} />
        <PageBody>
          <NoAccess title={t("noAccess")} back={{ href: "/settings", label: tn("settings") }}>
            {t("noAccessHint")}
          </NoAccess>
        </PageBody>
      </>
    )
  }
  return (
    <>
      <Topbar crumbs={[...crumbs, { label: t("titleNew") }]} />
      <PageBody>
        <PageHeader title={t("titleNew")} description={t("descriptionNew")} />
        <RoleEditor data={d} />
      </PageBody>
    </>
  )
}
