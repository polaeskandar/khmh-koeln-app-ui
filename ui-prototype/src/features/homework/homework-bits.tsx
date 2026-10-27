import Link from "next/link"
import { CalendarDays, ChevronRight, NotebookPen } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { useFormat } from "@/i18n/format"
import { daysBetween } from "@/lib/domain/time"
import type { LocalDate } from "@/lib/domain/types"
import type { Format } from "@/lib/format"
import type { HomeworkRow } from "@/server/queries/learning"

import { CompletionMeter, HomeworkStatusBadge } from "../lessons/lesson-bits"

type HomeworkT = ReturnType<typeof useTranslations<"homework">>

/**
 * Due dates are a gentle guide, never a deadline that punishes: parents read
 * "was due", staff read "after the due date", nobody reads "overdue" or "late".
 * Components use useDueLabel(); async server components pass
 * getTranslations("homework") and getFormat().
 */
export function dueLabel(
  t: HomeworkT,
  f: Format,
  dueDate: LocalDate | null,
  today: LocalDate
): string {
  if (!dueDate) return t("due.none")
  const days = daysBetween(today, dueDate)
  if (days === 0) return t("due.today")
  if (days === 1) return t("due.tomorrow")
  if (days > 1 && days < 7)
    return t("due.inDays", { weekday: f.weekdayShort(dueDate), count: days })
  if (days === -1) return t("due.yesterday")
  if (days < 0) return t("due.past", { date: f.dayMonth(dueDate) })
  return t("due.on", { date: f.dayMonth(dueDate) })
}

/** The due line in the current language: "Due today", "Was due Sun 8 Nov"… */
export function useDueLabel() {
  const t = useTranslations("homework")
  const f = useFormat()
  return (dueDate: LocalDate | null, today: LocalDate) => dueLabel(t, f, dueDate, today)
}

export function DueLine({
  dueDate,
  today,
  className,
}: {
  dueDate: LocalDate | null
  today: LocalDate
  className?: string
}) {
  const due = useDueLabel()
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
      {due(dueDate, today)}
    </span>
  )
}

/** A homework task in a staff list: status, due date and parent-reported completion. */
export function HomeworkListItem({
  hw,
  href,
  today,
  showLesson = false,
}: {
  hw: HomeworkRow
  href: string
  today: LocalDate
  showLesson?: boolean
}) {
  const t = useTranslations("homework")
  const f = useFormat()
  return (
    <Link
      href={href}
      className="-mx-2 flex flex-col gap-3 px-2 py-4 hover:bg-muted/60 sm:flex-row sm:items-center"
    >
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <NotebookPen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{hw.title}</span>
            <HomeworkStatusBadge status={hw.status} />
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DueLine dueDate={hw.dueDate} today={today} />
            {showLesson ? (
              <span className="text-xs text-muted-foreground">
                {hw.lesson.title} · {f.relativeDay(hw.lesson.teachingDate, today)}
              </span>
            ) : null}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-3 ps-7 sm:w-64 sm:ps-0">
        {hw.counts ? (
          <span className="flex flex-1 flex-col gap-1">
            <CompletionMeter completed={hw.counts.completed} assigned={hw.counts.assigned} />
            {hw.counts.withoutParentAccount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("childrenWithoutAccount", { count: hw.counts.withoutParentAccount })}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">{t("notVisibleYet")}</span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </span>
    </Link>
  )
}
