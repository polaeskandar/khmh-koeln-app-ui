import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { SignInForm } from "@/features/auth/sign-in-form"
import { getState } from "@/server/mock/state"
import { homeOf } from "@/server/request"
import { getViewer } from "@/server/viewer"

export async function generateMetadata() {
  return { title: (await getTranslations("auth.signIn"))("title") }
}

export default async function SignInPage() {
  const viewer = await getViewer()

  if (viewer) {
    redirect(viewer.mustChangePassword ? "/change-password" : homeOf(getState(), viewer))
  }

  const t = await getTranslations("auth.signIn")

  return (
    <AuthFrame
      aside={
        <>
          <h2 className="font-heading text-base font-semibold text-foreground">
            {t("asideTitle")}
          </h2>
          <p className="text-muted-foreground">{t("asideText")}</p>
          <p className="text-muted-foreground">{t("asidePrivacy")}</p>
        </>
      }
    >
      <AuthHeading title={t("title")}>{t("description")}</AuthHeading>
      <SignInForm />
    </AuthFrame>
  )
}
