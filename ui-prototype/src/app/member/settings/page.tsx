import { getTranslations } from "next-intl/server"

import { PersonalSettings } from "@/features/settings/personal-settings"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") }
}

export default async function MemberSettingsPage() {
  const ctx = await getMemberContext()
  const t = await getTranslations("settings")

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <PersonalSettings ctx={ctx} dataHref="/member/settings/data" />
    </>
  )
}
