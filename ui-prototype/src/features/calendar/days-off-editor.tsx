"use client"

import { Hand, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { type DayMark, YearCalendar } from "@/components/year-calendar"
import { useServerAction } from "@/hooks/use-server-action"
import type { DaysOffMode, LocalDate } from "@/lib/domain/types"
import { setDaysOffModeAction, toggleDayOffAction } from "@/server/actions/calendar"

export function DaysOffEditor({
  serviceId,
  year,
  mode,
  marks,
  feasts,
  meetings,
  today,
  canManage,
}: {
  serviceId: string
  year: number
  mode: DaysOffMode
  marks: Record<LocalDate, DayMark>
  feasts: Record<LocalDate, string>
  meetings: LocalDate[]
  today: LocalDate
  canManage: boolean
}) {
  const t = useTranslations("daysOff")
  const setMode = useServerAction(setDaysOffModeAction)
  const toggle = useServerAction(toggleDayOffAction, { toastOnSuccess: false })
  const options = [
    {
      value: "automatic" as const,
      icon: Sparkles,
      title: t("automatic"),
      hint: t("automaticHint"),
    },
    { value: "custom" as const, icon: Hand, title: t("custom"), hint: t("customHint") },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label={t("modeLabel")} className="grid gap-2 md:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            disabled={!canManage || setMode.pending}
            onClick={() => mode !== o.value && setMode.execute(serviceId, year, o.value)}
            className={cn(
              "flex gap-3 border p-4 text-start transition-colors enabled:hover:bg-muted/50 disabled:cursor-default",
              mode === o.value && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
          >
            <o.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{o.title}</span>
              <span className="text-xs text-pretty text-muted-foreground">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 bg-warning-soft ring-1 ring-warning/60" aria-hidden="true" />
          {t("legendMarked")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 bg-danger-soft ring-1 ring-destructive/40" aria-hidden="true" />
          {t("legendLocked")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 bg-primary" aria-hidden="true" />
          {t("legendMeets")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 bg-warning" aria-hidden="true" />
          {t("legendFeast")}
        </span>
        {canManage ? <span>{mode === "custom" ? t("clickHint") : t("switchHint")}</span> : null}
      </div>
      <YearCalendar
        year={year}
        marks={marks}
        feasts={feasts}
        meetings={meetings}
        today={today}
        onToggle={
          canManage && mode === "custom" ? (date) => toggle.execute(serviceId, date) : undefined
        }
      />
    </div>
  )
}
