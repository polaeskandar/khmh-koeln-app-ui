"use client"

import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { resetDemoDataAction } from "@/server/actions/prototype"

/** Prototype only: start over from the seed data and the demo clock's start time. */
export function ResetDemoButton() {
  const t = useTranslations("settings.prototype")
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <RotateCcw data-icon="inline-start" />
          {t("reset")}
        </Button>
      }
      title={t("resetTitle")}
      description={t("resetDescription")}
      confirmLabel={t("resetConfirm")}
      onConfirm={async () => {
        await resetDemoDataAction()
        toast.success(t("resetDone"))
        return true
      }}
    />
  )
}
