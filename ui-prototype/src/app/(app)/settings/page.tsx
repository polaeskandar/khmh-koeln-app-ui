import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { PersonalSettings } from "@/features/settings/personal-settings"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("settings") }
}

export default async function SettingsPage() {
  const ctx = await getStaffContext()
  const t = await getTranslations("settings")

  return (
    <>
      <Topbar crumbs={[{ label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        <PersonalSettings ctx={ctx} dataHref="/settings/data" />
      </PageBody>
    </>
  )
}
