"use client"

import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { ReasonDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { reopenSessionAction } from "@/server/actions/meetings"

/** Service leaders reopen a closed session to correct it; the reason stays in the history. */
export function ReopenButton({ sessionId, group }: { sessionId: string; group: string }) {
  const t = useTranslations("attendance.reopen")
  const router = useRouter()
  const reopen = useServerAction(reopenSessionAction, {
    onSuccess: () => router.push(`/attendance/${sessionId}`),
  })
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline">
          <RotateCcw data-icon="inline-start" />
          {t("button")}
        </Button>
      }
      title={t("title", { group })}
      description={t("description")}
      reasonHint={t("hint")}
      placeholder={t("placeholder")}
      confirmLabel={t("confirm")}
      onConfirm={async (reason) => (await reopen.execute(sessionId, reason)).ok}
    />
  )
}
