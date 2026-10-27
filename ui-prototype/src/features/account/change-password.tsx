"use client"

import { useTransition } from "react"
import { KeyRound } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { forgotPasswordAction } from "@/server/actions/auth"

/** Changing the password goes through an email link, like a forgotten one: one flow to build and secure. */
export function ChangePassword({ email }: { email: string }) {
  const t = useTranslations("account.password")
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-col gap-3 border p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-prose text-sm text-muted-foreground">{t("text")}</p>
      <Button
        variant="outline"
        className="shrink-0"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await forgotPasswordAction(email)
            toast.success(t("sent"))
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
        {t("send")}
      </Button>
    </div>
  )
}
