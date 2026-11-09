"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CircleCheck, Link2Off, MailCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { confirmEmailAction } from "@/server/actions/auth"

import { AuthHeading } from "./auth-frame"

/** The token of a link like /confirm-email#token=…: after the "#", so it never reaches a server. */
const tokenInAddress = () => new URLSearchParams(window.location.hash.slice(1)).get("token")

const subscribeNothing = () => () => {}

function StateIcon({ icon: Icon, className }: { icon: typeof MailCheck; className: string }) {
  return (
    <span className={cn("inline-flex size-11 items-center justify-center", className)}>
      <Icon className="size-5" aria-hidden="true" />
    </span>
  )
}

/**
 * The page the confirmation link opens: it confirms the address at once, so the registration
 * reaches the office. An unknown, used, replaced or expired link gets the same answer.
 */
export function ConfirmEmail() {
  const t = useTranslations("auth.confirmEmail")
  const [outcome, setOutcome] = useState<"confirming" | "confirmed" | "invalid">("confirming")
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    // Read in an effect: during a client navigation, rendering happens before the address changes.
    void confirmEmailAction(tokenInAddress() ?? "").then(({ confirmed }) =>
      setOutcome(confirmed ? "confirmed" : "invalid")
    )
  }, [])

  if (outcome === "confirmed") {
    return (
      <>
        <StateIcon icon={CircleCheck} className="bg-success-soft text-success" />
        <AuthHeading title={t("confirmedTitle")}>
          <p className="max-w-prose">{t("confirmedText")}</p>
        </AuthHeading>
        <Button variant="outline" asChild className="self-start">
          <Link href="/sign-in">{t("back")}</Link>
        </Button>
      </>
    )
  }

  if (outcome === "invalid") {
    return (
      <>
        <StateIcon icon={Link2Off} className="bg-warning-soft text-warning" />
        <AuthHeading title={t("title")}>
          <p className="max-w-prose">{t("linkInvalid")}</p>
        </AuthHeading>
        <Button asChild className="self-start">
          <Link href="/register">{t("register")}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <StateIcon icon={MailCheck} className="bg-muted text-muted-foreground" />
      <AuthHeading title={t("title")}>
        <p className="inline-flex max-w-prose items-center gap-2" role="status">
          <Spinner aria-hidden="true" />
          {t("confirming")}
        </p>
      </AuthHeading>
    </>
  )
}

/**
 * Prototype only: no email is sent, so the thank-you page links to the confirmation link itself.
 * The registration form passes its token on in the address. Without one, the text stays plain.
 */
export function ConfirmationLink({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeNothing, tokenInAddress, () => null)
  if (!token) return children
  return (
    <Link
      href={`/confirm-email#token=${token}`}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
    </Link>
  )
}
