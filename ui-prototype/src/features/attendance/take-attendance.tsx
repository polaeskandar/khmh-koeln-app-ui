"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardCheck, LockOpen } from "lucide-react"
import { useTranslations } from "next-intl"

import { sessionHref } from "@/components/session-bits"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import type { LocalDate } from "@/lib/domain/types"
import type { SessionCard } from "@/lib/view-models"
import { openSessionAction } from "@/server/actions/meetings"

/** Opens a scheduled session (if needed) and goes to its attendance screen. */
function useOpenAndGo() {
  const router = useRouter()
  const { execute, pending } = useServerAction(openSessionAction, { toastOnSuccess: false })
  async function go(session: SessionCard) {
    if (session.status === "scheduled") {
      const result = await execute(session.id)
      if (!result.ok) return false
    }
    router.push(sessionHref(session))
    return true
  }
  return { go, pending }
}

export function OpenAttendanceButton({
  session,
  size = "sm",
  className,
  label,
}: {
  session: SessionCard
  size?: "sm" | "default" | "lg"
  className?: string
  label?: string
}) {
  const t = useTranslations("attendance")
  const { go, pending } = useOpenAndGo()
  return (
    <Button size={size} className={className} disabled={pending} onClick={() => go(session)}>
      {pending ? <Spinner data-icon="inline-start" /> : <LockOpen data-icon="inline-start" />}
      {label ?? t("open")}
    </Button>
  )
}

/** The next step for a session card, depending on its state and the person's role. */
export function SessionCardAction({ session, today }: { session: SessionCard; today: LocalDate }) {
  const t = useTranslations("attendance")
  if (session.status === "active" && session.can.record) {
    return (
      <Button size="sm" asChild>
        <Link href={sessionHref(session)}>
          <ClipboardCheck data-icon="inline-start" />
          {t("take")}
        </Link>
      </Button>
    )
  }
  if (session.status === "scheduled" && session.can.record && session.date <= today) {
    return <OpenAttendanceButton session={session} />
  }
  if (session.status === "completed" || session.status === "active") {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link href={sessionHref(session)}>{t("view")}</Link>
      </Button>
    )
  }
  return null
}
