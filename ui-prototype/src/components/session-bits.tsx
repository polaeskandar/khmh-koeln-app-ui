import Link from "next/link"
import { Clock, MapPin, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { RosterCells } from "@/components/roster-cells"
import { ServiceTag } from "@/components/service-tag"
import { MovedBadge, OneOffBadge, SessionStatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import { isolate } from "@/lib/bidi"
import { addDays } from "@/lib/domain/time"
import type { LocalDate } from "@/lib/domain/types"
import type { Format } from "@/lib/format"
import type { AgendaItem, PlannedOccurrence, SessionCard } from "@/lib/view-models"

/**
 * Small building blocks for showing sessions consistently everywhere: the
 * same words for the same states, and counts that never call someone absent
 * just because they have not been marked yet.
 */

export function sessionHref(s: Pick<SessionCard, "id" | "status">) {
  return s.status === "completed" ? `/attendance/${s.id}/summary` : `/attendance/${s.id}`
}

type SessionT = ReturnType<typeof useTranslations<"session">>

/**
 * The count lines of a session in the current language. Components use
 * useSessionLines(); async server components getSessionLines() from
 * "@/i18n/server".
 */
export function sessionLines(t: SessionT, f: Format) {
  return {
    /** "9 of 14 present" or "12 present" for open sessions. */
    present(s: SessionCard): string {
      const c = s.counts
      if (s.rosterMode === "open" || c.rosterSize === null)
        return t("present", { count: c.present })
      const line = t("presentOf", { present: c.rosterPresent, total: c.rosterSize })
      return c.notOnRoster > 0 ? `${line} · ${t("notOnRoster", { count: c.notOnRoster })}` : line
    },
    /** What the open roster places mean at this point in the session's life. */
    remainder(s: SessionCard, today: LocalDate): string | null {
      const c = s.counts
      if (s.status === "canceled") return s.cancelReason ? isolate(s.cancelReason) : t("canceled")
      if (s.rosterMode === "open" || c.rosterSize === null) {
        return s.status === "scheduled" ? t("openRosterScheduled") : t("openRoster")
      }
      if (s.status === "active") {
        return c.notMarked === 0 ? t("everyoneHere") : t("notCheckedIn", { count: c.notMarked })
      }
      if (s.status === "completed") {
        return c.notMarked === 0
          ? t("everyoneWasPresent")
          : t("notMarkedPresent", { count: c.notMarked })
      }
      if (s.date < today) return t("notTaken")
      return t("onRoster", { count: c.rosterSize })
    },
    /** When the generator will create a planned date's session: on the calendar day before. */
    createdOn(createdOn: LocalDate, today: LocalDate): string {
      if (createdOn === today) return t("createdToday")
      if (createdOn === addDays(today, 1)) return t("createdTomorrow")
      return t("createdOn", { date: f.dayMonth(createdOn) })
    },
  }
}

export function useSessionLines() {
  return sessionLines(useTranslations("session"), useFormat())
}

export function SessionWhen({
  item,
  today,
  withDate = false,
  className,
}: {
  item: Pick<AgendaItem, "date" | "startTime" | "endTime" | "location">
  today: LocalDate
  withDate?: boolean
  className?: string
}) {
  const f = useFormat()
  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Clock className="size-3.5" aria-hidden="true" />
        {withDate ? `${f.relativeDay(item.date, today)}${f.locale === "ar" ? "،" : ","} ` : ""}
        {f.timeRange(item.startTime, item.endTime)}
      </span>
      {item.location ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.location}</span>
        </span>
      ) : null}
    </span>
  )
}

export function SessionBadges({ item, soft }: { item: AgendaItem; soft?: boolean }) {
  if (item.kind === "planned") return <SessionStatusBadge status="planned" soft={soft} />
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <SessionStatusBadge status={item.status} soft={soft} />
      {item.moved && item.status === "scheduled" ? <MovedBadge /> : null}
      {item.oneOff ? <OneOffBadge /> : null}
    </span>
  )
}

/** Today's meeting as a card: who meets, where, how full, and the next step. */
export function SessionCardView({
  session,
  today,
  action,
  className,
}: {
  session: SessionCard
  today: LocalDate
  action?: React.ReactNode
  className?: string
}) {
  const lines = useSessionLines()
  const c = session.counts
  const canceled = session.status === "canceled"
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 border bg-card p-4",
        session.status === "active" &&
          "border-primary/40 shadow-[inset_3px_0_0_var(--primary)] rtl:shadow-[inset_-3px_0_0_var(--primary)]",
        canceled && "bg-muted/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <ServiceTag service={session.service} className="text-xs" />
        <SessionBadges item={session} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className={cn(
            "font-heading text-lg leading-tight font-semibold tracking-tight",
            canceled && "text-muted-foreground line-through decoration-1"
          )}
        >
          <Link href={sessionHref(session)} className="hover:underline hover:underline-offset-4">
            {session.group}
          </Link>
        </h3>
        <p className="truncate text-sm text-muted-foreground">{session.title}</p>
        <SessionWhen item={session} today={today} />
      </div>
      {!canceled && session.rosterMode === "expected" && c.rosterSize ? (
        <div className="flex flex-col gap-2">
          <RosterCells
            filled={c.rosterPresent}
            total={c.rosterSize}
            extra={c.notOnRoster}
            size="md"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium tabular-nums">{lines.present(session)}</span>
            <span className="text-muted-foreground tabular-nums">
              {lines.remainder(session, today)}
            </span>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {!canceled ? <UsersRound className="size-3.5" aria-hidden="true" /> : null}
          <span className="tabular-nums">
            {canceled
              ? lines.remainder(session, today)
              : `${lines.present(session)} · ${lines.remainder(session, today)}`}
          </span>
        </p>
      )}
      {action ? <div className="mt-auto flex flex-wrap gap-2 pt-1">{action}</div> : null}
    </article>
  )
}

/** One line in a list of sessions or planned dates. `compact` fits a narrow side column. */
export function AgendaRow({
  item,
  today,
  href,
  trailing,
  compact = false,
  className,
}: {
  item: AgendaItem
  today: LocalDate
  href?: string
  trailing?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  const f = useFormat()
  const lines = useSessionLines()
  const planned = item.kind === "planned"
  const canceled = !planned && item.status === "canceled"
  const detail = planned ? (
    <span className="text-xs text-muted-foreground">
      {lines.createdOn((item as PlannedOccurrence).createdOn, today)}
    </span>
  ) : item.status === "active" || item.status === "completed" ? (
    <span className="text-xs text-muted-foreground tabular-nums">{lines.present(item)}</span>
  ) : canceled && item.cancelReason ? (
    <span dir="auto" className="max-w-64 text-xs text-pretty text-muted-foreground">
      {item.cancelReason}
    </span>
  ) : null
  const name = (
    <span
      className={cn(
        "truncate font-medium",
        canceled && "text-muted-foreground line-through decoration-1"
      )}
    >
      {item.group}
    </span>
  )
  const content = (
    <>
      <div className={cn("shrink-0 text-center leading-none", compact ? "w-11" : "w-14")}>
        <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          {f.todayOrWeekday(item.date, today)}
        </div>
        <div className="mt-1 font-heading text-xl font-semibold tabular-nums">
          {f.dayOfMonth(item.date)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{f.monthShort(item.date)}</div>
      </div>
      {compact ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {name}
          <span className="truncate text-sm text-muted-foreground tabular-nums">
            {f.timeRange(item.startTime, item.endTime)}
            {item.location ? ` · ${item.location}` : ""}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {trailing ?? <SessionBadges item={item} />}
            {detail}
          </span>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              {name}
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                · {item.title}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <ServiceTag service={item.service} className="text-xs" />
              <SessionWhen item={item} today={today} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-end">
            {trailing ?? <SessionBadges item={item} />}
            {detail}
          </div>
        </>
      )}
    </>
  )
  const base = cn("flex min-w-0 items-center gap-3 py-3", planned && "opacity-80", className)
  return href ? (
    <Link href={href} className={cn(base, "-mx-2 px-2 hover:bg-muted/60")}>
      {content}
    </Link>
  ) : (
    <div className={base}>{content}</div>
  )
}
