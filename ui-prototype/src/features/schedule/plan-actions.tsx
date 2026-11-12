"use client"

import { useState } from "react"
import { CalendarCog } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { addDays } from "@/lib/domain/time"
import type { PlanRule } from "@/lib/domain/types"
import { changePlanAction, discardDraftAction } from "@/server/actions/schedule"

import { RuleFields } from "./rule-fields"

export function DiscardDraftButton({ scheduleId, year }: { scheduleId: string; year: number }) {
  const t = useTranslations("schedule.year")
  const { execute } = useServerAction(discardDraftAction)

  return (
    <ConfirmDialog
      trigger={<Button variant="outline">{t("discard")}</Button>}
      title={t("discardTitle", { year: String(year) })}
      description={t("discardHint")}
      confirmLabel={t("discard")}
      tone="destructive"
      onConfirm={async () => (await execute(scheduleId, year)).ok}
    />
  )
}

export function ChangePlanDialog({
  scheduleId,
  year,
  version,
  rule: initialRule,
  today,
}: {
  scheduleId: string
  year: number
  version: number
  rule: PlanRule
  today: string
}) {
  const t = useTranslations("schedule.change")
  const tc = useTranslations("common")
  const f = useFormat()
  const [open, setOpen] = useState(false)
  const [rule, setRule] = useState(initialRule)
  const [from, setFrom] = useState(addDays(today, 1))
  const [check, setCheck] = useState<{ replaced: number; added: number; kept: string[] } | null>(
    null
  )
  const dry = useServerAction(changePlanAction, { toastOnSuccess: false })
  const apply = useServerAction(changePlanAction)
  const errors = { ...dry.fieldErrors, ...apply.fieldErrors }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarCog data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)

          if (next) {
            setRule(initialRule)
            setFrom(addDays(today, 1))
            setCheck(null)
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("title", { year: String(year) })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <TextField
            type="date"
            label={t("from")}
            value={from}
            min={addDays(today, 1)}
            max={`${year}-12-31`}
            onChange={(e) => {
              setFrom(e.target.value)
              setCheck(null)
            }}
            error={errors.from}
            description={t("fromHint")}
          />
          <RuleFields
            rule={rule}
            onChange={(next) => {
              setRule(next)
              setCheck(null)
            }}
            errors={errors}
            year={year}
            hideDates
          />
          {check ? (
            <div className="flex flex-col gap-2 border bg-muted/40 p-4 text-sm">
              <p>{t("outcome", { replaced: check.replaced, added: check.added })}</p>
              {check.kept.length > 0 ? (
                <p className="text-muted-foreground">
                  {t("kept", { dates: f.list(check.kept.map((d) => f.dayMonth(d))) })}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            {check ? (
              <Button
                disabled={apply.pending}
                onClick={async () => {
                  const result = await apply.execute({
                    scheduleId,
                    year,
                    from,
                    rule,
                    version,
                    dryRun: false,
                  })

                  if (result.ok) {
                    setOpen(false)
                  }
                }}
              >
                {t("apply")}
              </Button>
            ) : (
              <Button
                disabled={dry.pending}
                onClick={async () => {
                  const result = await dry.execute({
                    scheduleId,
                    year,
                    from,
                    rule,
                    version,
                    dryRun: true,
                  })

                  if (result.ok) {
                    setCheck(result.data)
                  }
                }}
              >
                {t("check")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
