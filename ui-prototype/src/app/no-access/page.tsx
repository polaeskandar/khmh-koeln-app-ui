import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { SignOutLink } from "@/app/change-password/sign-out-link"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { accountName } from "@/server/queries/present"
import { homeOf } from "@/server/request"
import { getContext } from "@/server/viewer"

export async function generateMetadata() {
  return { title: (await getTranslations("auth.noAccess"))("title") }
}

/** An account an administrator created before giving it any access, or whose access ended. */
export default async function NoAccessPage() {
  const ctx = await getContext()
  const home = homeOf(ctx.state, ctx.viewer)

  if (home !== "/no-access") {
    redirect(home)
  }

  const t = await getTranslations("auth.noAccess")

  return (
    <AuthFrame>
      <AuthHeading title={t("title")}>
        <p>{t("hint", { name: accountName(ctx.state, ctx.viewer) })}</p>
      </AuthHeading>
      <SignOutLink />
    </AuthFrame>
  )
}
