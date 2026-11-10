import { BookOpen, CalendarX2, Clock, MapPin, MoveRight, Repeat, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ServiceTag } from "@/components/service-tag"
import { useFormat } from "@/i18n/format"
import { isolate } from "@/lib/bidi"
import type { LocalDate } from "@/lib/domain/types"
import type { MemberGroup, MemberMeeting } from "@/server/queries/member"

import type { TaskHref } from "../parent/parent-bits"

/** Member tasks open in the member portal. */
export const memberTaskHref: TaskHref = (task) => `/member/homework/${task.id}`

/**
 * One group the member is in: the service and stage, when and where it meets,
 * who serves it, and the passage and memory verse of the last lesson.
 */
export function GroupCard({ group, today }: { group: MemberGroup; today: LocalDate }) {
  const t = useTranslations("member.groups")
  const f = useFormat()
  const name = group.stage?.name ?? group.service.name
  return (
    <article className="flex flex-col gap-3 border p-4" aria-label={name}>
      <header className="flex flex-col gap-1">
        {group.stage ? <ServiceTag service={group.service} className="text-xs" /> : null}
        <h3 className="flex items-center gap-2 font-heading text-base leading-snug font-semibold tracking-tight">
          {group.stage ? null : <ServiceTag service={group.service} label="" />}
          <bdi>{name}</bdi>
        </h3>
      </header>

      {group.schedules.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {group.schedules.map((sch) => (
            <li key={sch.id} className="flex items-start gap-2">
              <Repeat
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {[
                  f.recurrence(sch.recurrence),
                  f.timeRange(sch.startTime, sch.endTime),
                  sch.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noSchedule")}</p>
      )}

      {group.servants.length > 0 ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <UsersRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("servants", { names: f.list(group.servants.map(isolate)) })}</span>
        </p>
      ) : null}

      {group.lastLesson ? (
        <div className="flex flex-col gap-2 bg-muted/50 p-3">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
            {t("lastLesson", {
              title: group.lastLesson.title,
              date: f.relativeDayInline(group.lastLesson.teachingDate, today),
            })}
          </span>
          {group.lastLesson.passage ? (
            <p dir="auto" className="text-sm font-medium">
              {group.lastLesson.passage}
            </p>
          ) : null}
          {group.lastLesson.memoryVerse ? (
            <blockquote
              dir="auto"
              className="border-s-2 border-primary ps-3 font-heading text-sm leading-relaxed text-pretty"
            >
              {group.lastLesson.memoryVerse}
            </blockquote>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** The member's next meetings, soonest first. Canceled ones say so, without the servants' reason. */
export function MeetingList({ meetings, today }: { meetings: MemberMeeting[]; today: LocalDate }) {
  const t = useTranslations("member.meetings")
  const f = useFormat()
  if (meetings.length === 0) {
    return <p className="border border-dashed p-5 text-sm text-muted-foreground">{t("empty")}</p>
  }
  return (
    <ul className="flex flex-col divide-y border-y">
      {meetings.map((m) => {
        const canceled = m.status === "canceled"
        return (
          <li key={m.key} className="flex items-start gap-4 py-3">
            <span
              className={cn(
                "flex w-12 shrink-0 flex-col items-center border py-1.5 leading-none",
                m.date === today && !canceled && "border-foreground"
              )}
              aria-hidden="true"
            >
              <span className="text-[11px] text-muted-foreground">
                {f.todayOrWeekday(m.date, today)}
              </span>
              <span className="font-heading text-lg font-semibold tabular-nums">
                {f.dayOfMonth(m.date)}
              </span>
              <span className="text-[11px] text-muted-foreground">{f.monthShort(m.date)}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="sr-only">{f.relativeDay(m.date, today, "long")}</span>
              <span
                className={cn(
                  "leading-snug font-medium",
                  canceled && "text-muted-foreground line-through"
                )}
              >
                <bdi>{m.group}</bdi>
                <span className="font-normal text-muted-foreground"> · {m.title}</span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {f.timeRange(m.startTime, m.endTime)}
                </span>
                {m.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {m.location}
                  </span>
                ) : null}
                <ServiceTag service={m.service} />
              </span>
              {canceled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <CalendarX2 className="size-3.5" aria-hidden="true" />
                  {t("canceled")}
                </span>
              ) : m.moved ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-info">
                  <MoveRight className="size-3.5" aria-hidden="true" />
                  {t("moved")}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
