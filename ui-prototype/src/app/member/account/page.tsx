import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PreferencesFields } from "@/components/preferences-menu"
import { ChangePassword } from "@/features/account/change-password"
import { OwnData } from "@/features/privacy/own-data"
import { getFormat } from "@/i18n/server"
import { today } from "@/server/mock/clock"
import { getMemberAccount } from "@/server/queries/member"
import { getOwnPrivacy } from "@/server/queries/privacy"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("member.nav")
  return { title: t("account") }
}

export default async function MemberAccountPage() {
  const ctx = await getMemberContext()
  const [d, privacy, t, ta, tn, tp, f] = await Promise.all([
    getMemberAccount(ctx),
    getOwnPrivacy(ctx),
    getTranslations("member.account"),
    getTranslations("account"),
    getTranslations("member.nav"),
    getTranslations("parent.account"),
    getFormat(),
  ])
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {tn("account")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 border p-5 text-sm">
        <dt className="text-muted-foreground">{tp("name")}</dt>
        <dd className="font-medium">{d.name}</dd>
        <dt className="text-muted-foreground">{tp("email")}</dt>
        <dd className="truncate">{d.email}</dd>
        <dt className="text-muted-foreground">{t("groups")}</dt>
        <dd>
          {d.member
            ? d.member.groups.length > 0
              ? f.list(
                  d.member.groups.map((g) => (g.stage ? `${g.stage} (${g.service})` : g.service))
                )
              : t("noGroups")
            : t("notLinked")}
        </dd>
      </dl>

      <section className="flex flex-col gap-3" aria-labelledby="preferences">
        <h2 id="preferences" className="font-heading text-base font-semibold tracking-tight">
          {ta("preferences")}
        </h2>
        <PreferencesFields />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="password">
        <h2 id="password" className="font-heading text-base font-semibold tracking-tight">
          {ta("password.title")}
        </h2>
        <ChangePassword email={d.email} />
      </section>

      <section className="flex flex-col gap-2 text-sm" aria-labelledby="church-sees">
        <h2 id="church-sees" className="font-heading text-base font-semibold tracking-tight">
          {t("churchSees.title")}
        </h2>
        <p className="text-muted-foreground">{t("churchSees.body")}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="your-data">
        <div className="flex flex-col gap-0.5">
          <h2 id="your-data" className="font-heading text-base font-semibold tracking-tight">
            {ta("data")}
          </h2>
          <p className="text-sm text-muted-foreground">{ta("dataDescription")}</p>
        </div>
        <OwnData privacy={privacy} today={today()} />
      </section>

      <section
        className="flex flex-col gap-2 border border-dashed p-5 text-sm"
        aria-labelledby="prototype"
      >
        <h2
          id="prototype"
          className="inline-flex items-center gap-2 font-heading text-base font-semibold tracking-tight"
        >
          <FlaskConical className="size-4 text-muted-foreground" aria-hidden="true" />
          {tp("prototype.title")}
        </h2>
        <p className="text-muted-foreground">
          {t.rich("prototype", {
            link: (chunks) => (
              <Link href="/sign-in" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  )
}
