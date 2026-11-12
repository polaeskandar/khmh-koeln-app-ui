"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarCheck2, Church, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormPanel } from "@/components/form-panel"
import { useOccasionName } from "@/components/session-card"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { type OccasionHit, type PreviewRow, previewRows } from "@/lib/domain/planning"
import { isValidLocalTime } from "@/lib/domain/time"
import type { LocalDate, PlanDecision, PlanRule } from "@/lib/domain/types"
import type { UnitRef } from "@/lib/view-models"
import { savePlanAction } from "@/server/actions/schedule"

import { RuleFields } from "./rule-fields"

function Row({
  row,
  onChange,
  canKeepMandatory,
}: {
  row: PreviewRow
  onChange: (decision: PlanDecision) => void
  canKeepMandatory: boolean
}) {
  const t = useTranslations("schedule.editor")
  const tc = useTranslations("occasionCategories")
  const f = useFormat()
  const occasionName = useOccasionName()
  const meets = row.decision === "keep"
  const locked = row.mandatory && !canKeepMandatory
  const label = f.dayMonth(row.date)

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        row.hits.length > 0 && "bg-warning-soft/40",
        !meets && "text-muted-foreground"
      )}
    >
      <span className="flex w-9 shrink-0 flex-col items-center leading-none">
        <span
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            !meets && "line-through"
          )}
        >
          {f.dayOfMonth(row.date)}
        </span>
        <span className="text-[10px] tracking-wider uppercase">{f.weekdayShort(row.date)}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {row.hits.length > 0 ? (
          row.hits.map((h: OccasionHit) => (
            <span
              key={h.id}
              className="flex flex-wrap items-center gap-1.5 text-sm text-foreground"
            >
              {h.mode === "mandatory" ? (
                <Church className="size-3.5 text-warning" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5 text-warning" aria-hidden="true" />
              )}
              <span className="font-medium">{occasionName(h) || t("markedByHand")}</span>
              <span className="text-xs text-muted-foreground">
                {h.mode === "mandatory"
                  ? t("mandatory")
                  : h.category
                    ? tc(h.category)
                    : t("dayOff")}
              </span>
            </span>
          ))
        ) : (
          <span className="text-sm">{meets ? t("meets") : t("canceledByYou")}</span>
        )}
        {row.hits.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {meets ? t("keptAnyway") : row.mandatory ? t("canceledByChurch") : t("suggestedCancel")}
          </span>
        ) : null}
      </div>
      <Switch
        checked={meets}
        disabled={locked}
        aria-label={t("meetsOn", { date: label })}
        onCheckedChange={(checked) => onChange(checked ? "keep" : "cancel")}
      />
    </li>
  )
}

export function PlanEditor({
  unit,
  scheduleId,
  version,
  year,
  rule: initialRule,
  decisions: initialDecisions,
  hits,
  unverified,
  canKeepMandatory,
  returnTo,
}: {
  unit: UnitRef
  scheduleId: string
  version: number | null
  year: number
  rule: PlanRule
  decisions: Record<LocalDate, PlanDecision>
  hits: Record<LocalDate, OccasionHit[]>
  unverified: boolean
  canKeepMandatory: boolean
  returnTo: string
}) {
  const t = useTranslations("schedule.editor")
  const f = useFormat()
  const router = useRouter()
  const [rule, setRule] = useState(initialRule)
  const [decisions, setDecisions] = useState(initialDecisions)
  const [confirming, setConfirming] = useState(false)
  const { execute, pending, fieldErrors, problem } = useServerAction(savePlanAction, {
    onSuccess: () => router.push(returnTo),
  })
  const rows = useMemo(
    () => previewRows(rule, year, hits, decisions),
    [rule, year, hits, decisions]
  )
  const meets = rows.filter((r) => r.decision === "keep").length
  const months = useMemo(() => {
    const map = new Map<string, PreviewRow[]>()

    for (const row of rows) {
      map.set(row.date.slice(0, 7), [...(map.get(row.date.slice(0, 7)) ?? []), row])
    }

    return [...map.entries()]
  }, [rows])
  const timeMissing = !isValidLocalTime(rule.startTime)

  const save = (confirm: boolean) =>
    execute({ scheduleId, year, rule, decisions, version, confirm })

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <FormPanel title={t("when")}>
          <RuleFields rule={rule} onChange={setRule} errors={fieldErrors} year={year} />
        </FormPanel>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => save(false)}>
            {t("saveDraft")}
          </Button>
          <Button
            disabled={pending || timeMissing || meets === 0}
            onClick={() => setConfirming(true)}
          >
            <CalendarCheck2 data-icon="inline-start" />
            {t("confirm")}
          </Button>
        </div>
        {problem && !problem.fieldErrors ? (
          <p className="text-sm text-destructive">{problem.detail}</p>
        ) : null}
      </div>
      <section aria-labelledby="preview" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="preview" className="font-heading text-lg font-semibold">
              {t("previewTitle", { year: String(year) })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("previewCounts", { count: meets, canceled: rows.length - meets })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusBadge tone="warning" icon={Sparkles}>
              {t("legendSuggested")}
            </StatusBadge>
            <StatusBadge tone="warning" icon={Church}>
              {t("legendMandatory")}
            </StatusBadge>
          </div>
        </div>
        {unverified ? (
          <p className="flex items-start gap-2 border border-warning/40 bg-warning-soft/40 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t("unverified", { year: String(year) })}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("noDates")}
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {months.map(([key, items]) => (
              <section key={key} className="border bg-card" aria-label={f.monthYear(`${key}-01`)}>
                <h3 className="flex items-baseline justify-between border-b px-3 py-2 text-sm font-semibold">
                  {f.monthYear(`${key}-01`)}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {timeMissing ? null : f.timeRange(rule.startTime, rule.endTime)}
                  </span>
                </h3>
                <ul className="divide-y">
                  {items.map((row) => (
                    <Row
                      key={row.date}
                      row={row}
                      canKeepMandatory={canKeepMandatory}
                      onChange={(decision) => {
                        const next = { ...decisions }

                        if (decision === row.proposed) {
                          delete next[row.date]
                        } else {
                          next[row.date] = decision
                        }

                        setDecisions(next)
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle", { year: String(year) })}
        description={t("confirmDescription", {
          count: meets,
          where: unit.name,
        })}
        consequences={[
          t("confirmCreates", { count: meets }),
          t("confirmCanceled", { count: rows.length - meets }),
          t("confirmLater"),
        ]}
        confirmLabel={t("confirm")}
        onConfirm={async () => (await save(true)).ok}
      />
    </div>
  )
}
