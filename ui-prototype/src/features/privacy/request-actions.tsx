"use client"

import { useId, useState } from "react"
import { Ban, Download, Send, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog, ReasonDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useServerAction } from "@/hooks/use-server-action"
import {
  completeCopyRequestAction,
  declineDataRequestAction,
  eraseDataAction,
} from "@/server/actions/privacy"

/** What the administrator can do with an open request: download, erase or mark as sent, or decline. */
export function RequestActions({
  requestId,
  kind,
  subject,
  erases,
  mentions,
  canErase,
}: {
  requestId: string
  kind: "erasure" | "copy"
  subject: string
  /** What erasing deletes, already worded ("23 attendance marks"). */
  erases: string[]
  /** How many notes may mention the person. */
  mentions: number
  /** False for the administrator's own account. */
  canErase: boolean
}) {
  const t = useTranslations("privacy.actions")
  const checkbox = useId()
  const [dialog, setDialog] = useState<"erase" | "decline" | "sent" | null>(null)
  const [clearNotes, setClearNotes] = useState(true)
  const erase = useServerAction(eraseDataAction)
  const decline = useServerAction(declineDataRequestAction)
  const complete = useServerAction(completeCopyRequestAction)
  const open = (which: typeof dialog) => (next: boolean) => setDialog(next ? which : null)

  return (
    <>
      <Button variant="outline" asChild>
        <a href={`/settings/data-requests/${requestId}/copy`} download>
          <Download data-icon="inline-start" />
          {kind === "copy" ? t("downloadCopy") : t("downloadFirst")}
        </a>
      </Button>
      <Button variant="outline" onClick={() => setDialog("decline")}>
        <Ban data-icon="inline-start" />
        {t("decline")}
      </Button>
      {kind === "erasure" ? (
        <Button variant="destructive" onClick={() => setDialog("erase")} disabled={!canErase}>
          <Trash2 data-icon="inline-start" />
          {t("erase")}
        </Button>
      ) : (
        <Button onClick={() => setDialog("sent")}>
          <Send data-icon="inline-start" />
          {t("markSent")}
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "erase"}
        onOpenChange={open("erase")}
        title={t("eraseTitle", { name: subject })}
        description={t("eraseDescription")}
        consequences={[...erases, t("eraseKeeps")]}
        note={
          mentions > 0 ? (
            <span className="flex items-start gap-2">
              <Checkbox
                id={checkbox}
                checked={clearNotes}
                onCheckedChange={(v) => setClearNotes(v === true)}
                className="mt-0.5"
              />
              <label htmlFor={checkbox} className="cursor-pointer text-foreground">
                {t("clearNotes", { count: mentions })}
              </label>
            </span>
          ) : undefined
        }
        confirmLabel={t("eraseConfirm")}
        tone="destructive"
        onConfirm={async () => (await erase.execute(requestId, clearNotes)).ok}
      />
      <ReasonDialog
        open={dialog === "decline"}
        onOpenChange={open("decline")}
        title={t("declineTitle")}
        description={t("declineDescription")}
        reasonLabel={t("declineReason")}
        placeholder={t("declinePlaceholder")}
        requireReason
        confirmLabel={t("declineConfirm")}
        onConfirm={async (reason) => (await decline.execute(requestId, reason ?? "")).ok}
      />
      <ConfirmDialog
        open={dialog === "sent"}
        onOpenChange={open("sent")}
        title={t("sentTitle")}
        description={t("sentDescription")}
        confirmLabel={t("markSent")}
        onConfirm={async () => (await complete.execute(requestId)).ok}
      />
    </>
  )
}
