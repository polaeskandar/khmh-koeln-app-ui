"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { forgotPasswordAction } from "@/server/actions/auth"

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot")
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span className="inline-flex size-11 items-center justify-center bg-success-soft text-success">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <p className="max-w-prose text-sm">
          {t.rich("sent", {
            email: () => (
              <bdi dir="ltr" className="font-medium">
                {sentTo}
              </bdi>
            ),
          })}
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">{t("sentHint")}</p>
        <p className="max-w-prose border border-dashed p-4 text-sm text-muted-foreground">
          {t("prototype")}
        </p>
        <Button variant="outline" asChild className="self-start">
          <Link href="/sign-in">{t("back")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await forgotPasswordAction(email)
          setSentTo(email.trim())
        })
      }}
    >
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {t("submit")}
      </Button>
      <Link
        href="/sign-in"
        className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("back")}
      </Link>
    </form>
  )
}
