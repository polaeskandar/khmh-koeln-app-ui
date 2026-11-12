import Link from "next/link"
import { CalendarPlus, CalendarRange, CheckCircle2, CircleDashed } from "lucide-react"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { useOccasionName } from "@/components/session-card"
import { DraftBadge, OneOffBadge, RescheduledBadge, SessionStatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useFormat } from "@/i18n/format"
import { getFormat } from "@/i18n/server"
import type { PreviewRow } from "@/lib/domain/planning"
import type { SessionCard } from "@/lib/view-models"
import type { getUnitSchedule } from "@/server/queries/schedule"

import { ChangePlanDialog, DiscardDraftButton } from "./plan-actions"
import { ruleSummary } from "./rule-summary"
import { AddOneOffButton, SessionMenu } from "./session-dialogs"

type Data = ReturnType<typeof getUnitSchedule>

export function YearSwitch({
  years,
  year,
  href,
}: {
  years: number[]
  year: number
  href: (year: number) => string
}) {
  const t = useTranslations("schedule.year")

  return (
    <nav className="flex border" aria-label={t("chooseYear")}>
      {years.map((y) => (
        <Link
          key={y}
          href={href(y)}
          aria-current={y === year ? "page" : undefined}
          className={cn(
            "px-4 py-2 text-sm font-medium text-muted-foreground tabular-nums hover:bg-muted",
            y === year && "bg-foreground text-background hover:bg-foreground"
          )}
        >
          {y}
        </Link>
      ))}
    </nav>
  )
}

function SessionRow({ session, today }: { session: SessionCard; today: string }) {
  const t = useTranslations()
  const f = useFormat()
  const occasionName = useOccasionName()
  const canceled = session.status === "canceled"
  const past = session.date < today

  return (
    <li
      className={cn("flex items-center gap-3 py-2", past && !canceled && "text-muted-foreground")}
    >
      <span
        className={cn(
          "flex w-10 shrink-0 flex-col items-center leading-none",
          session.date === today && "text-primary"
        )}
      >
        <span className="font-heading text-lg font-semibold tabular-nums">
          {f.dayOfMonth(session.date)}
        </span>
        <span className="text-[10px] tracking-wider uppercase">{f.weekdayShort(session.date)}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm tabular-nums", canceled && "line-through decoration-1")}>
          {f.timeRange(session.startTime, session.endTime)}
          {session.location ? (
            <span className="text-muted-foreground"> · {session.location}</span>
          ) : null}
        </span>
        {canceled ? (
          <span className="truncate text-xs text-destructive">
            {session.occasion
              ? occasionName(session.occasion)
              : (session.cancelReason ?? t("schedule.year.canceledByHand"))}
          </span>
        ) : null}
      </div>
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {session.kind === "oneOff" ? <OneOffBadge /> : null}
        {session.kind === "recurring" && session.originalDate ? <RescheduledBadge /> : null}
        {canceled || session.status === "open" || (past && session.status === "closed") ? (
          <SessionStatusBadge status={session.status} />
        ) : null}
      </div>
      <SessionMenu session={session} today={today} />
    </li>
  )
}

function Months({ sessions, today }: { sessions: SessionCard[]; today: string }) {
  const f = useFormat()
  const months = new Map<string, SessionCard[]>()

  for (const x of sessions) {
    const key = x.date.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), x])
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...months.entries()].map(([key, items]) => (
        <section key={key} className="flex flex-col border bg-card" aria-label={key}>
          <h3 className="flex items-baseline justify-between border-b px-4 py-2.5 font-heading text-sm font-semibold">
            <span>{f.monthYear(`${key}-01`)}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {items.filter((x) => x.status !== "canceled").length}
            </span>
          </h3>
          <ul className="divide-y px-4">
            {items.map((x) => (
              <SessionRow key={x.id} session={x} today={today} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function DraftPreview({ rows }: { rows: PreviewRow[] }) {
  const t = useTranslations("schedule.year")
  const f = useFormat()
  const occasionName = useOccasionName()
  const canceled = rows.filter((r) => r.decision === "cancel")

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{t("draftCounts", { count: rows.length - canceled.length, canceled: canceled.length })}</p>
      {canceled.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {canceled.map((r) => (
            <li
              key={r.date}
              className="border border-destructive/30 px-2 py-0.5 text-xs text-destructive"
            >
              {f.dayMonth(r.date)}
              {r.hits[0] ? ` · ${occasionName(r.hits[0]) || t("dayOff")}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export async function UnitSchedule({
  data,
  hrefFor,
  planHref,
}: {
  data: Data
  hrefFor: (year: number) => string
  planHref: string
}) {
  const t = await getTranslations("schedule.year")
  const f = await getFormat()
  const { plan, sessions, year } = data
  const active = sessions.filter((x) => x.status !== "canceled")
  const oneOffDefaults = {
    date: data.today.slice(0, 4) === String(year) ? data.today : `${year}-01-01`,
    startTime: plan?.rule.startTime ?? "",
    endTime: plan?.rule.endTime ?? null,
    location: plan?.rule.location ?? null,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearSwitch years={data.years} year={year} href={hrefFor} />
        {data.canManage ? (
          <div className="flex flex-wrap gap-2">
            <AddOneOffButton
              scheduleId={data.scheduleId}
              unitName={data.unit.name}
              defaults={oneOffDefaults}
            />
            {plan?.status === "confirmed" ? (
              <ChangePlanDialog
                scheduleId={data.scheduleId}
                year={year}
                version={plan.version}
                rule={plan.rule}
                today={data.today}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {plan === null ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlus />
            </EmptyMedia>
            <EmptyTitle>{t("notPlannedTitle", { year: String(year) })}</EmptyTitle>
            <EmptyDescription>
              {data.canManage ? t("notPlannedHint") : t("notPlannedReadOnly")}
            </EmptyDescription>
          </EmptyHeader>
          {data.canManage ? (
            <EmptyContent>
              <Button asChild>
                <Link href={planHref}>{t("prepare", { year: String(year) })}</Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : plan.status === "draft" ? (
        <section className="flex flex-col gap-4 border border-warning/40 bg-warning-soft/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CircleDashed className="size-4 text-warning" aria-hidden="true" />
                <h3 className="font-heading font-semibold">
                  {t("draftTitle", { year: String(year) })}
                </h3>
                <DraftBadge />
              </div>
              <p className="text-sm text-muted-foreground">
                {ruleSummary(f, plan.rule)}
                {plan.updatedBy ? ` · ${t("savedBy", { name: plan.updatedBy.name })}` : ""}
              </p>
            </div>
            {data.canManage ? (
              <div className="flex gap-2">
                <DiscardDraftButton scheduleId={data.scheduleId} year={year} />
                <Button asChild>
                  <Link href={planHref}>{t("continue")}</Link>
                </Button>
              </div>
            ) : null}
          </div>
          <DraftPreview rows={plan.preview} />
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 border p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold">
                {t("confirmedTitle", { year: String(year) })}
              </h3>
              <p className="text-sm text-muted-foreground">{ruleSummary(f, plan.rule)}</p>
              {plan.confirmedBy && plan.confirmedAt ? (
                <p className="text-xs text-muted-foreground">
                  {t("confirmedBy", {
                    name: plan.confirmedBy.name,
                    date: f.mediumDate(plan.confirmedAt.slice(0, 10)),
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("sessions")}</dt>
              <dd className="font-heading text-xl font-semibold tabular-nums">{active.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("canceled")}</dt>
              <dd className="font-heading text-xl font-semibold tabular-nums">
                {sessions.length - active.length}
              </dd>
            </div>
          </dl>
        </section>
      )}
      {sessions.length > 0 ? (
        <Months sessions={sessions} today={data.today} />
      ) : plan?.status === "confirmed" ? null : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarRange className="size-4" aria-hidden="true" />
          {t("noSessionsYet")}
        </p>
      )}
    </div>
  )
}
