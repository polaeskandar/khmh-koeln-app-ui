import Link from "next/link"
import { ArrowRight, FlaskConical } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { AuthFrame, AuthHeading } from "@/features/auth/auth-frame"
import { SignInForm } from "@/features/auth/sign-in-form"
import { getFormat } from "@/i18n/server"
import { today } from "@/server/mock/clock"
import { DEMO_PASSWORD } from "@/server/mock/passwords"

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn")
  return { title: t("title") }
}

export default async function SignInPage() {
  const [t, f] = await Promise.all([getTranslations("auth"), getFormat()])
  const date = today()
  return (
    <AuthFrame
      aside={
        <>
          <p className="flex flex-col gap-0.5">
            <span className="font-medium">{f.longDate(date)}</span>
            <span className="text-muted-foreground">{f.copticDate(date)}</span>
          </p>
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              {t("signIn.newHere")}
            </h2>
            <p className="max-w-prose text-muted-foreground">{t("signIn.newHereText")}</p>
            <Button variant="outline" asChild className="self-start">
              <Link href="/register">
                {t("signIn.register")}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <div className="flex flex-col gap-2 border border-dashed p-4">
            <p className="flex items-center gap-2 font-medium">
              <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
              {t("signIn.prototypeTitle")}
            </p>
            <p className="text-muted-foreground">
              {t.rich("signIn.prototypeText", {
                password: () => (
                  <code
                    dir="ltr"
                    className="bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
                  >
                    {DEMO_PASSWORD}
                  </code>
                ),
              })}
            </p>
            <Link
              href="/sign-in/demo"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("signIn.chooseDemo")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      }
    >
      <AuthHeading title={t("signIn.title")}>{t("signIn.intro")}</AuthHeading>
      <SignInForm />
    </AuthFrame>
  )
}
