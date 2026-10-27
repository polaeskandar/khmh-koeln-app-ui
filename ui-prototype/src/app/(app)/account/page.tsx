import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { PreferencesFields } from "@/components/preferences-menu"
import { ChangePassword } from "@/features/account/change-password"
import { OwnData } from "@/features/privacy/own-data"
import { today } from "@/server/mock/clock"
import { getOwnPrivacy } from "@/server/queries/privacy"
import { getStaffContext } from "@/server/request"
import { viewerInfo } from "@/server/queries/present"

export async function generateMetadata() {
  const t = await getTranslations("account")
  return { title: t("title") }
}

/** The signed-in person's own account: details, preferences, password and their data. */
export default async function AccountPage() {
  const ctx = await getStaffContext()
  const [t, privacy] = await Promise.all([getTranslations("account"), getOwnPrivacy(ctx)])
  const me = viewerInfo(ctx, ctx.viewer)
  const tr = await getTranslations("roles")
  return (
    <>
      <Topbar crumbs={[{ label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="grid max-w-3xl gap-10">
          <Section id="details" title={t("details")}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border p-5 text-sm">
              <dt className="text-muted-foreground">{t("name")}</dt>
              <dd className="font-medium">{me.name}</dd>
              <dt className="text-muted-foreground">{t("email")}</dt>
              <dd className="truncate">
                <bdi dir="ltr">{me.email}</bdi>
              </dd>
              <dt className="text-muted-foreground">{t("roles")}</dt>
              <dd>
                <ul className="flex flex-col gap-1">
                  {me.roles.map((r, i) => (
                    <li key={i}>
                      {tr(r.role)}
                      {r.stage || r.service ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {r.stage ? `${r.service?.name} › ${r.stage.name}` : r.service?.name}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </dl>
            <p className="text-sm text-muted-foreground">{t("detailsHint")}</p>
          </Section>
          <Section id="preferences" title={t("preferences")}>
            <PreferencesFields />
          </Section>
          <Section id="password" title={t("password.title")}>
            <ChangePassword email={me.email} />
          </Section>
          <Section id="data" title={t("data")} description={t("dataDescription")}>
            <OwnData privacy={privacy} today={today()} />
          </Section>
        </div>
      </PageBody>
    </>
  )
}
