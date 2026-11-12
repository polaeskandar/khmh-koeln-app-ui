import { Download } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Section } from "@/components/page-header"
import { PreferencesFields } from "@/components/preferences-menu"
import { Button } from "@/components/ui/button"
import { ChangePasswordForm } from "@/features/auth/change-password-form"
import { getFormat } from "@/i18n/server"
import { roleSummary, accountName } from "@/server/queries/present"
import type { Context } from "@/server/viewer"

import { DeletionRequest } from "./deletion-request"

export async function PersonalSettings({ ctx, dataHref }: { ctx: Context; dataHref: string }) {
  const t = await getTranslations("settings")
  const f = await getFormat()
  const { state: s, viewer } = ctx
  const pending = s.dataRequests.find(
    (r) => r.personId === viewer.personId && r.kind === "erasure" && r.status === "open"
  )

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <Section title={t("account.title")} description={t("account.hint")}>
        <ul className="divide-y border bg-card">
          <li className="flex flex-col gap-0.5 p-4">
            <span className="text-xs text-muted-foreground">{t("account.name")}</span>
            <span className="font-medium">{accountName(s, viewer)}</span>
          </li>
          <li className="flex flex-col gap-0.5 p-4">
            <span className="text-xs text-muted-foreground">{t("account.username")}</span>
            <span className="font-mono font-medium" dir="ltr">
              {viewer.username}
            </span>
          </li>
          <li className="flex flex-col gap-0.5 p-4">
            <span className="text-xs text-muted-foreground">{t("account.roles")}</span>
            <span className="text-sm">{roleSummary(s, viewer) || t("account.noRoles")}</span>
          </li>
        </ul>
      </Section>
      <Section title={t("preferences.title")} description={t("preferences.hint")}>
        <PreferencesFields />
      </Section>
      <Section title={t("password.title")} description={t("password.hint")}>
        <ChangePasswordForm required={false} />
      </Section>
      <Section title={t("data.title")} description={t("data.hint")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("data.copy")}</span>
              <span className="text-sm text-muted-foreground">{t("data.copyHint")}</span>
            </div>
            <Button asChild variant="outline">
              <a href={dataHref} download>
                <Download data-icon="inline-start" />
                {t("data.download")}
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("data.delete")}</span>
              <span className="text-sm text-muted-foreground">
                {pending
                  ? t("data.deletePending", { date: f.mediumDate(pending.dueOn) })
                  : t("data.deleteHint")}
              </span>
            </div>
            {pending ? null : <DeletionRequest />}
          </div>
        </div>
      </Section>
    </div>
  )
}
