import Link from "next/link"
import { CirclePause, MapPin, Repeat, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ServiceSwatch } from "@/components/service-tag"
import { MovedBadge, StatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import type { Format } from "@/lib/format"
import type { ScheduleSummary } from "@/lib/view-models"

/** The "meetings" translator, from useTranslations("meetings") or getTranslations("meetings"). */
type MeetingsT = ReturnType<typeof useTranslations<"meetings">>

/** Who a schedule's sessions expect: a roster size, or open to everyone. */
export function rosterLabel(t: MeetingsT, s: Pick<ScheduleSummary, "rosterMode" | "rosterSize">) {
  if (s.rosterMode === "open") return t("roster.open")
  return t("roster.size", { count: s.rosterSize ?? 0 })
}

export function nextLabel(
  t: MeetingsT,
  f: Format,
  next: ScheduleSummary["next"],
  today: LocalDate
) {
  if (!next) return null
  const when = { when: f.relativeDay(next.date, today), time: next.startTime }
  if (next.status === "canceled") return t("list.nextCanceled", when)
  if (next.status === "active") return t("list.nowOpen")
  return t("list.next", when)
}

export function ScheduleList({
  schedules,
  today,
  showService = true,
  emptyText,
  trailing,
}: {
  schedules: ScheduleSummary[]
  today: LocalDate
  showService?: boolean
  emptyText: string
  trailing?: (s: ScheduleSummary) => React.ReactNode
}) {
  const t = useTranslations("meetings")
  const f = useFormat()
  if (schedules.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ul className="divide-y border-y">
      {schedules.map((s) => (
        <li
          key={s.id}
          className={cn("flex items-center gap-3", !s.active && "text-muted-foreground")}
        >
          <Link
            href={`/meetings/schedules/${s.id}`}
            className="-mx-2 grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1.5 px-2 py-3 hover:bg-muted/60 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,170px)]"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                {showService ? <ServiceSwatch tone={s.service.tone} /> : null}
                <span className={cn("truncate font-medium", !s.active && "text-muted-foreground")}>
                  {s.group}
                </span>
                <span className="truncate text-sm text-muted-foreground">· {s.name}</span>
              </span>
              {showService && s.group !== s.service.name ? (
                <span className="truncate text-xs text-muted-foreground">{s.service.name}</span>
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">
                  {f.recurrence(s.recurrence)} · {f.timeRange(s.startTime, s.endTime)}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
                {s.location ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{s.location}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="size-3 shrink-0" aria-hidden="true" />
                  {rosterLabel(t, s)}
                </span>
              </span>
            </span>
            <span className="flex flex-col items-start gap-1 text-sm md:items-end">
              {s.active ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums md:justify-end">
                  {nextLabel(t, f, s.next, today) ?? t("list.noUpcoming")}
                  {s.next?.moved && s.next.status !== "active" ? <MovedBadge /> : null}
                </span>
              ) : (
                <StatusBadge tone="muted" icon={CirclePause}>
                  {t("list.inactive")}
                </StatusBadge>
              )}
              <span className="text-xs text-muted-foreground">
                {t("list.sessionsSoFar", { count: s.sessionCount })}
              </span>
            </span>
          </Link>
          {trailing ? <div className="shrink-0">{trailing(s)}</div> : null}
        </li>
      ))}
    </ul>
  )
}
