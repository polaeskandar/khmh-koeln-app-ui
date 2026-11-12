"use client"

import { Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { requestOwnErasureAction } from "@/server/actions/privacy"

export function DeletionRequest() {
  const t = useTranslations("settings.data")
  const { execute } = useServerAction(requestOwnErasureAction)

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive">
          <Trash2 data-icon="inline-start" />
          {t("deleteButton")}
        </Button>
      }
      title={t("deleteTitle")}
      description={t("deleteConfirm")}
      confirmLabel={t("deleteButton")}
      tone="destructive"
      onConfirm={async () => (await execute()).ok}
    />
  )
}
