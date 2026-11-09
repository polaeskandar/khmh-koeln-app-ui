import { getTranslations } from "next-intl/server"

import { AuthFrame } from "@/features/auth/auth-frame"
import { ConfirmEmail } from "@/features/auth/confirm-email"

export async function generateMetadata() {
  const t = await getTranslations("auth.confirmEmail")
  return { title: t("title") }
}

/** Opened from the link in the registration email: /confirm-email#token=…, valid 7 days. */
export default function ConfirmEmailPage() {
  return (
    <AuthFrame>
      <ConfirmEmail />
    </AuthFrame>
  )
}
