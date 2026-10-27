import type { LucideIcon } from "lucide-react"
import {
  Ban,
  CalendarPlus,
  CheckCheck,
  LockOpen,
  MoveRight,
  PencilLine,
  RotateCcw,
} from "lucide-react"

import { useTranslations } from "next-intl"

import { useFormat } from "@/i18n/format"
import { localDateOf, localTimeOf } from "@/lib/domain/time"
import type { LocalDate } from "@/lib/domain/types"
import type { HistoryEntry } from "@/lib/view-models"

/**
 * A session's history, oldest first. Adapted from the shadcnblocks block
 * "timeline9" (vertical line, icon per event): plain sentences instead of
 * cards, and every entry says who did it and when.
 */
const ICON: Record<HistoryEntry["type"], LucideIcon> = {
  created: CalendarPlus,
  opened: LockOpen,
  closed: CheckCheck,
  reopened: RotateCcw,
  canceled: Ban,
  moved: MoveRight,
  edited: PencilLine,
}

export function HistoryTimeline({ entries, today }: { entries: HistoryEntry[]; today: LocalDate }) {
  const t = useTranslations("history")
  const f = useFormat()
  const detailText = (d: HistoryEntry["detail"]) => {
    if (!d) return null
    if (d.kind === "fromSchedule") return t("createdFromSchedule")
    if (d.kind === "byHand") return t("createdByHand")
    return t("movedFrom", { date: f.dayMonth(localDateOf(d.at)), time: localTimeOf(d.at) })
  }
  return (
    <ol className="relative flex flex-col gap-5 ps-1">
      <span className="absolute start-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
      {entries.map((e) => {
        const Icon = ICON[e.type]
        const detail = detailText(e.detail)
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center border bg-background text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
              <span className="text-sm font-medium">{t(e.type)}</span>
              <span className="text-xs text-muted-foreground">
                {f.instantLabel(e.at, today)}
                {e.actor ? ` · ${e.actor.name}` : null}
              </span>
              {detail ? (
                <span className="text-sm text-pretty text-muted-foreground">{detail}</span>
              ) : null}
              {e.note ? (
                <span dir="auto" className="text-sm text-pretty text-muted-foreground">
                  {e.note}
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
