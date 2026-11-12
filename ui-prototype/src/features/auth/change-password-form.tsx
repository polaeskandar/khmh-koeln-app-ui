"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { changePasswordAction } from "@/server/actions/auth"

import { PasswordField } from "./password-input"

export function ChangePasswordForm({ required }: { required: boolean }) {
  const t = useTranslations("auth.changePassword")
  const router = useRouter()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const { execute, pending, fieldErrors } = useServerAction(changePasswordAction, {
    onSuccess: (data) => {
      setCurrent("")
      setNext("")
      setConfirmation("")

      if (data.home) {
        router.push(data.home)
      }
    },
  })

  return (
    <form
      className="flex max-w-md flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void execute({ current, next, confirmation })
      }}
    >
      <PasswordField
        label={required ? t("temporary") : t("current")}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={fieldErrors.current}
      />
      <PasswordField
        label={t("next")}
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={fieldErrors.next}
        description={t("rules")}
      />
      <PasswordField
        label={t("confirmation")}
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        error={fieldErrors.confirmation}
      />
      <Button type="submit" disabled={pending} className="self-start">
        {required ? t("submitRequired") : t("submit")}
      </Button>
    </form>
  )
}
