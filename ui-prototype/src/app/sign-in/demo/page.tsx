import { getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { DemoAccountButton } from "@/features/auth/demo-account-button"
import { describeAccess } from "@/lib/access-summary"
import { personasOf } from "@/server/queries/shell"
import { getState } from "@/server/mock/state"

export default async function DemoSignInPage() {
  const t = await getTranslations("auth.demo")
  const ts = await getTranslations("access.summary")
  const personas = personasOf(getState())
  const words = {
    administrator: ts("administrator"),
    parent: ts("parent"),
    member: ts("member"),
    none: ts("none"),
  }

  return (
    <AuthFrame>
      <AuthHeading title={t("title")}>{t("description")}</AuthHeading>
      <ul className="grid gap-2 sm:grid-cols-2">
        {personas.map((p) => (
          <li key={p.id}>
            <DemoAccountButton
              id={p.id}
              name={p.name}
              username={p.username}
              summary={describeAccess(p, words)}
            />
          </li>
        ))}
      </ul>
    </AuthFrame>
  )
}
