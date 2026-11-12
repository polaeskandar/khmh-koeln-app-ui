import { getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { ChangePasswordForm } from "@/features/auth/change-password-form"
import { accountName } from "@/server/queries/present"
import { getSignedInContext } from "@/server/viewer"

import { SignOutLink } from "./sign-out-link"

export async function generateMetadata() {
  return { title: (await getTranslations("auth.changePassword"))("title") }
}

export default async function ChangePasswordPage() {
  const ctx = await getSignedInContext()
  const t = await getTranslations("auth.changePassword")

  return (
    <AuthFrame>
      <AuthHeading title={t("title")}>
        <p>
          {t("welcome", {
            name: accountName(ctx.state, ctx.viewer),
            username: ctx.viewer.username,
          })}
        </p>
        <p>{ctx.viewer.mustChangePassword ? t("why") : t("whyOptional")}</p>
      </AuthHeading>
      <ChangePasswordForm required={ctx.viewer.mustChangePassword} />
      <SignOutLink />
    </AuthFrame>
  )
}
