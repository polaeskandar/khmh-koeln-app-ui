"use client"

import { useOptimistic, useTransition } from "react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { useFormat } from "@/i18n/format"
import { daysInMonth, isoWeekday } from "@/lib/domain/time"
import { ISO_WEEKDAYS, type LocalDate } from "@/lib/domain/types"

export type DayMark = { label: string; kind: "marked" | "locked" }

const pad = (n: number) => String(n).padStart(2, "0")

function Month({
  year,
  month,
  marks,
  feasts,
  meetings,
  today,
  onToggle,
}: {
  year: number
  month: number
  marks: Record<LocalDate, DayMark>
  feasts: Record<LocalDate, string>
  meetings: Set<LocalDate>
  today: LocalDate
  onToggle: ((date: LocalDate) => void) | null
}) {
  const t = useTranslations("daysOff")
  const f = useFormat()
  const first = `${year}-${pad(month)}-01`
  const offset = isoWeekday(first) - 1
  const days = Array.from(
    { length: daysInMonth(first) },
    (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`
  )

  return (
    <section className="flex flex-col gap-2 border bg-card p-3" aria-label={f.monthYear(first)}>
      <h3 className="text-sm font-semibold">{f.monthYear(first)}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center" role="grid">
        {ISO_WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
            role="columnheader"
          >
            {f.weekdayMin(d)}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((date) => {
          const mark = marks[date]
          const feast = feasts[date]
          const meets = meetings.has(date)
          const label = [f.dayMonth(date), mark?.label ?? feast, meets ? t("meetsThatDay") : null]
            .filter(Boolean)
            .join(" · ")
          const editable = onToggle !== null && mark?.kind !== "locked"

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              title={label}
              aria-label={label}
              aria-selected={mark ? true : false}
              disabled={!editable}
              onClick={() => onToggle?.(date)}
              className={cn(
                "relative flex aspect-square min-h-8 flex-col items-center justify-center text-xs tabular-nums transition-colors",
                editable &&
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                !editable && "cursor-default",
                mark?.kind === "marked" &&
                  "bg-warning-soft font-semibold text-foreground ring-1 ring-warning/60",
                mark?.kind === "locked" &&
                  "bg-danger-soft font-semibold text-destructive ring-1 ring-destructive/40",
                date === today && "outline outline-1 outline-foreground"
              )}
            >
              {Number(date.slice(8))}
              <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden="true">
                {meets ? (
                  <span className={cn("size-1", mark ? "bg-muted-foreground" : "bg-primary")} />
                ) : null}
                {feast && !mark ? <span className="size-1 bg-warning" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function YearCalendar({
  year,
  marks,
  feasts,
  meetings,
  today,
  onToggle,
}: {
  year: number
  marks: Record<LocalDate, DayMark>
  feasts: Record<LocalDate, string>
  meetings: LocalDate[]
  today: LocalDate
  onToggle?: (date: LocalDate) => Promise<unknown>
}) {
  const [, start] = useTransition()
  const [optimistic, toggle] = useOptimistic(marks, (current, date: LocalDate) => {
    const next = { ...current }

    if (next[date]) {
      delete next[date]
    } else {
      next[date] = { label: feasts[date] ?? "", kind: "marked" }
    }

    return next
  })
  const meetingSet = new Set(meetings)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <Month
          key={i}
          year={year}
          month={i + 1}
          marks={optimistic}
          feasts={feasts}
          meetings={meetingSet}
          today={today}
          onToggle={
            onToggle
              ? (date) =>
                  start(async () => {
                    toggle(date)
                    await onToggle(date)
                  })
              : null
          }
        />
      ))}
    </div>
  )
}
