import { getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form"

export async function generateMetadata() {
  const t = await getTranslations("auth.forgot")
  return { title: t("title") }
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot")
  return (
    <AuthFrame>
      <AuthHeading title={t("title")}>
        <p className="max-w-prose">{t("intro")}</p>
      </AuthHeading>
      <ForgotPasswordForm />
    </AuthFrame>
  )
}
