import Link from "next/link"
import { useTranslations } from "next-intl"

import { useSessionLines } from "@/components/session-bits"
import { ServiceSwatch } from "@/components/service-tag"
import { MovedBadge, SessionStatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import type { UpcomingEntry } from "@/server/queries/dashboard"

/** The next days, one block per day; parallel meetings of a service share a line. */
export function ComingUp({ entries, today }: { entries: UpcomingEntry[]; today: LocalDate }) {
  const t = useTranslations("session")
  const f = useFormat()
  const lines = useSessionLines()
  const days = [...new Set(entries.map((e) => e.date))]
  return (
    <div className="flex flex-col gap-5">
      {days.map((date) => (
        <div key={date} className="flex flex-col">
          <h3 className="border-b pb-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {f.relativeDay(date, today, "short")}
          </h3>
          <ul className="divide-y">
            {entries
              .filter((e) => e.date === date)
              .map((e) => (
                <li key={e.key}>
                  <Link
                    href={e.href}
                    className="-mx-2 flex items-start gap-3 px-2 py-2.5 hover:bg-muted/60"
                  >
                    <span className="w-12 shrink-0 pt-px text-sm font-medium tabular-nums">
                      {e.startTime}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-start gap-2">
                        <ServiceSwatch tone={e.service.tone} className="mt-2" />
                        <span
                          className={
                            e.status === "canceled"
                              ? "font-medium text-pretty text-muted-foreground line-through decoration-1"
                              : "font-medium text-pretty"
                          }
                        >
                          {e.count > 1 ? `${e.service.name} · ${e.label}` : e.label}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {e.status === "canceled"
                          ? (e.cancelReason ?? t("canceled"))
                          : `${e.count > 1 ? e.title : e.label === e.service.name ? e.title : `${e.service.name} · ${e.title}`} · ${f.timeRange(e.startTime, e.endTime)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {e.moved ? <MovedBadge /> : <SessionStatusBadge status={e.status} />}
                      {e.createdOn ? (
                        <span className="text-[11px] text-muted-foreground">
                          {lines.createdOn(e.createdOn, today)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
