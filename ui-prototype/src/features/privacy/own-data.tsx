"use client"

import { Download, Hourglass, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ReasonDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import { requestOwnErasureAction } from "@/server/actions/privacy"
import type { OwnPrivacy } from "@/server/queries/privacy"

/**
 * "Your data" on the account pages: download a copy of what the app stores
 * about you, or ask the church office to delete your account and data.
 */
export function OwnData({ privacy, today }: { privacy: OwnPrivacy; today: LocalDate }) {
  const t = useTranslations("privacy.own")
  const f = useFormat()
  const ask = useServerAction(requestOwnErasureAction)
  const requested = privacy.erasureRequested
  return (
    <div className="flex flex-col gap-5 border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-prose flex-col gap-1 text-sm">
          <p className="font-medium">{t("copyTitle")}</p>
          <p className="text-muted-foreground">{t("copyText")}</p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <a href="/account/data" download>
            <Download data-icon="inline-start" />
            {t("download")}
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-prose flex-col gap-1 text-sm">
          <p className="font-medium">{t("deleteTitle")}</p>
          {requested ? (
            <p className="flex items-start gap-2 text-muted-foreground" role="status">
              <Hourglass className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              {t("requested", {
                when: f.atLabel(requested.receivedAt, today),
                due: f.mediumDate(requested.dueOn),
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t("deleteText")}</p>
          )}
        </div>
        {requested ? null : (
          <ReasonDialog
            trigger={
              <Button variant="outline" className="shrink-0">
                <Trash2 data-icon="inline-start" />
                {t("delete")}
              </Button>
            }
            title={t("confirmTitle")}
            description={t("confirmText")}
            reasonLabel={t("noteLabel")}
            reasonHint={t("noteHint")}
            confirmLabel={t("confirm")}
            tone="destructive"
            onConfirm={async (note) => (await ask.execute(note)).ok}
          />
        )}
      </div>
    </div>
  )
}
