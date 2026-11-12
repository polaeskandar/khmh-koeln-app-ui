"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { signOutAction } from "@/server/actions/auth"

export function SignOutLink() {
  const t = useTranslations("shell")
  const [pending, start] = useTransition()

  return (
    <Button
      variant="link"
      className="self-start px-0"
      disabled={pending}
      onClick={() => start(() => signOutAction())}
    >
      {t("signOut")}
    </Button>
  )
}
