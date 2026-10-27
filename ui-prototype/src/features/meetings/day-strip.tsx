import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { LinkTabs } from "@/components/link-tabs"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"

/** Sessions and Schedules: the two views of Meetings. */
export function MeetingsTabs({ active }: { active: "sessions" | "schedules" }) {
  const t = useTranslations("meetings")
  const tn = useTranslations("nav")
  return (
    <LinkTabs
      label={tn("meetings")}
      active={active}
      items={[
        { key: "sessions", label: t("tabs.sessions"), href: "/meetings" },
        { key: "schedules", label: t("tabs.schedules"), href: "/meetings/schedules" },
      ]}
    />
  )
}

/**
 * Two weeks at a glance, adapted from the shadcnblocks "calendar25" agenda:
 * one cell per day with a small square per meeting in its service colour.
 * Each day is a link, so the selected day is part of the URL. The grid and
 * its scrolling follow the reading direction: in Arabic the first day is on
 * the right and the strip starts scrolled to the right.
 */
export function DayStrip({
  days,
  selected,
  today,
  href,
}: {
  days: { date: LocalDate; tones: number[]; count: number }[]
  selected: LocalDate
  today: LocalDate
  href: (date: LocalDate) => string
}) {
  const t = useTranslations("meetings")
  const f = useFormat()
  return (
    <nav aria-label={t("days.label")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ol className="grid min-w-[760px] grid-cols-14 border-y border-s">
        {days.map((d) => {
          const current = d.date === selected
          const isToday = d.date === today
          const past = d.date < today
          return (
            <li key={d.date} className="border-e">
              <Link
                href={href(d.date)}
                aria-current={current ? "date" : undefined}
                aria-label={t("days.day", { date: f.dayMonth(d.date), count: d.count })}
                className={cn(
                  "flex h-20 flex-col items-center justify-between py-2 transition-colors hover:bg-muted/60",
                  past && !current && "text-muted-foreground",
                  current && "bg-foreground text-background hover:bg-foreground/90"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-widest uppercase",
                    isToday && !current && "text-primary"
                  )}
                >
                  {f.todayOrWeekday(d.date, today)}
                </span>
                <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                  {f.dayOfMonth(d.date)}
                </span>
                <span className="flex h-2 items-center gap-0.5" aria-hidden="true">
                  {d.tones.slice(0, 5).map((tone, i) => (
                    <span
                      key={i}
                      className="size-1.5"
                      style={{ background: `var(--identity-${tone})` }}
                    />
                  ))}
                  {d.tones.length > 5 ? <span className="text-[9px] leading-none">+</span> : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
