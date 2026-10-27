import { getTranslations } from "next-intl/server"

import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { RegisterForm } from "@/features/auth/register-form"
import { MIN_PASSWORD_LENGTH } from "@/server/mock/passwords"
import { getRegistrationServices } from "@/server/queries/accounts"

export async function generateMetadata() {
  const t = await getTranslations("auth.register")
  return { title: t("title") }
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register")
  const steps = [t("step1"), t("step2"), t("step3")]
  return (
    <AuthFrame
      aside={
        <>
          <h2 className="font-heading text-base font-semibold tracking-tight">{t("nextTitle")}</h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 shrink-0 items-center justify-center border font-heading text-xs font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground">{t("childrenNoAccounts")}</p>
        </>
      }
    >
      <AuthHeading title={t("title")}>{t("intro")}</AuthHeading>
      <RegisterForm services={getRegistrationServices()} minPasswordLength={MIN_PASSWORD_LENGTH} />
    </AuthFrame>
  )
}
