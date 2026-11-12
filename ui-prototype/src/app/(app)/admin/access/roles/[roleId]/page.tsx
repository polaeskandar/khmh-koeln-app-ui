import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { RoleEditor } from "@/features/access/role-editor"
import { getRole } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

export default async function RolePage({ params }: PageProps<"/admin/access/roles/[roleId]">) {
  const { roleId } = await params
  const { role } = getRole(await getStaffContext(), roleId)
  const t = await getTranslations("access")

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/admin/access" }, { label: role!.name }]} />
      <PageBody>
        <PageHeader
          title={role!.name}
          description={role!.protected ? t("editor.protectedHint") : t("editor.hint")}
        />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <RoleEditor role={role} />
          <Section title={t("editor.holders", { count: role!.holders.length })}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {role!.holders.map((h) => (
                <li key={h.id} className="flex flex-col border-b pb-1.5">
                  <span className="font-medium">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.where ?? t("assignments.wholeChurch")}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </PageBody>
    </>
  )
}
