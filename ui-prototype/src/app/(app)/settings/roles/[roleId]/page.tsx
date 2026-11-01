import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { RoleEditor } from "@/features/settings/role-editor"
import { getRoleEditor } from "@/server/queries/roles"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("roleEditor")
  return { title: t("roles") }
}

/** One role: what it allows (everywhere in the church) and who has it. */
export default async function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params
  const ctx = await getStaffContext()
  const [d, t, tn] = await Promise.all([
    getRoleEditor(ctx, roleId),
    getTranslations("roleEditor"),
    getTranslations("nav"),
  ])
  const crumbs = [
    { label: tn("settings"), href: "/settings" },
    { label: t("roles"), href: "/settings#roles" },
  ]
  if (d === null) {
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
  if (!d?.role) notFound()
  const role = d.role
  return (
    <>
      <Topbar crumbs={[...crumbs, { label: role.name }]} />
      <PageBody>
        <PageHeader title={role.name} description={t("description")} />
        <RoleEditor key={`${role.id}:${role.permissions.join(",")}`} data={d} />
      </PageBody>
    </>
  )
}
