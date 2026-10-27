import {
  Archive,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  Eye,
  EyeOff,
  MoveRight,
  PencilLine,
  TriangleAlert,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { StatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import type { HomeworkStatus, LessonStatus, LocalDate } from "@/lib/domain/types"
import type { MeetingView } from "@/server/queries/learning"
import { isolate } from "@/lib/bidi"

export function LessonStatusBadge({
  status,
  archived,
  className,
}: {
  status: LessonStatus
  archived?: boolean
  className?: string
}) {
  const t = useTranslations("lessons.status")
  const tc = useTranslations("common")
  if (archived) {
    return (
      <StatusBadge tone="muted" icon={Archive} className={className}>
        {tc("archived")}
      </StatusBadge>
    )
  }
  switch (status) {
    case "draft":
      return (
        <StatusBadge tone="muted" icon={PencilLine} className={className}>
          {t("draft")}
        </StatusBadge>
      )
    case "ready":
      return (
        <StatusBadge tone="info" icon={CircleCheck} className={className}>
          {t("ready")}
        </StatusBadge>
      )
    case "completed":
      return (
        <StatusBadge tone="neutral" icon={CheckCheck} className={className} title={t("taught")}>
          {t("completed")}
        </StatusBadge>
      )
  }
}

export function HomeworkStatusBadge({
  status,
  className,
}: {
  status: HomeworkStatus
  className?: string
}) {
  const t = useTranslations("lessons.status")
  const tc = useTranslations("common")
  switch (status) {
    case "draft":
      return (
        <StatusBadge tone="muted" icon={EyeOff} className={className} title={t("draftHidden")}>
          {t("draft")}
        </StatusBadge>
      )
    case "published":
      return (
        <StatusBadge tone="success" icon={Eye} className={className} title={t("publishedVisible")}>
          {t("published")}
        </StatusBadge>
      )
    case "archived":
      return (
        <StatusBadge tone="muted" icon={Archive} className={className}>
          {tc("archived")}
        </StatusBadge>
      )
  }
}

/** One line about the meeting a lesson is prepared for; warns when it no longer happens as planned. */
export function MeetingLine({
  meeting,
  today,
  className,
}: {
  meeting: MeetingView
  today: LocalDate
  className?: string
}) {
  const t = useTranslations("lessons")
  const f = useFormat()
  const base = "inline-flex items-start gap-1.5 text-sm"
  switch (meeting.kind) {
    case "none":
      return (
        <span className={cn(base, "text-muted-foreground", className)}>
          <CircleDashed className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("meeting.none", { date: f.relativeDay(meeting.date, today) })}
        </span>
      )
    case "planned":
      return (
        <span className={cn(base, "text-muted-foreground", className)}>
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {[
            t("meeting.when", {
              title: isolate(meeting.title),
              date: f.relativeDayInline(meeting.date, today),
              time: meeting.startTime,
            }),
            t("meeting.createdOn", { date: f.dayMonth(meeting.createdOn) }),
          ].join(" · ")}
        </span>
      )
    case "not-on-schedule":
      return (
        <span className={cn(base, "text-warning", className)}>
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("meeting.notOnSchedule", {
            name: meeting.title ?? t("theSchedule"),
            date: f.dayMonth(meeting.date),
          })}
        </span>
      )
    case "session":
      if (meeting.status === "canceled") {
        const date = f.dayMonth(meeting.date)
        return (
          <span className={cn(base, "text-destructive", className)}>
            <CalendarX2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {/* One flex item, so the sentence wraps as text. The reason is free text in any script. */}
            <span>
              {meeting.cancelReason
                ? t.rich("meeting.canceledReason", {
                    date,
                    reason: meeting.cancelReason,
                    bdi: (chunks) => <bdi>{chunks}</bdi>,
                  })
                : t("meeting.canceled", { date })}
            </span>
          </span>
        )
      }
      return (
        <span
          className={cn(base, meeting.moved ? "text-info" : "text-muted-foreground", className)}
        >
          {meeting.moved ? (
            <MoveRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CalendarCheck2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          )}
          {[
            t("meeting.when", {
              title: isolate(meeting.title),
              date: f.relativeDayInline(meeting.date, today),
              time: f.timeRange(meeting.startTime, meeting.endTime),
            }),
            meeting.location,
            meeting.moved ? t("meeting.moved") : null,
            meeting.status === "active"
              ? t("meeting.attendanceOpen")
              : meeting.status === "completed"
                ? t("meeting.held")
                : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )
  }
}

/** Completion as a quiet bar and numbers. Parent-reported: never a score. */
export function CompletionMeter({
  completed,
  assigned,
  className,
}: {
  completed: number
  assigned: number
  className?: string
}) {
  const t = useTranslations("lessons")
  const ratio = assigned > 0 ? completed / assigned : 0
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm tabular-nums">
        {t.rich("completion", {
          completed,
          assigned,
          strong: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </span>
      <span className="h-1 w-full bg-muted" aria-hidden="true">
        <span
          className="block h-full bg-primary"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
    </div>
  )
}
