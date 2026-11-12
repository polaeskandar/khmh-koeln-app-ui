import Link from "next/link"
import { ArrowRight, ClipboardCheck, Clock, Eye, MapPin, PlayCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ServiceSwatch } from "@/components/service-tag"
import { OneOffBadge, RescheduledBadge, SessionStatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { useFormat } from "@/i18n/format"
import type { OccasionRef, SessionCard } from "@/lib/view-models"

export function useOccasionName() {
  const t = useTranslations("occasions")

  return (occasion: Pick<OccasionRef, "key" | "name">) =>
    occasion.name ?? (occasion.key ? t(occasion.key as never) : "")
}

export function PresentBar({ present, roster }: { present: number; roster: number }) {
  const total = Math.max(roster, present)
  const ratio = total === 0 ? 0 : present / total

  return (
    <div className="h-1.5 w-full bg-muted" aria-hidden="true">
      <div className="h-full bg-primary transition-[width]" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

export function SessionAction({ session, today }: { session: SessionCard; today: string }) {
  const t = useTranslations("attendance.actions")
  const href = `/attendance/${session.id}`

  if (session.status === "canceled") {
    return null
  }

  if (session.status === "open" && session.canRecord) {
    return (
      <Button asChild size="sm">
        <Link href={href}>
          <ClipboardCheck data-icon="inline-start" />
          {t("continue")}
        </Link>
      </Button>
    )
  }

  if (session.status === "scheduled" && session.date === today && session.canRecord) {
    return (
      <Button asChild size="sm">
        <Link href={href}>
          <PlayCircle data-icon="inline-start" />
          {t("open")}
        </Link>
      </Button>
    )
  }

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        {session.status === "closed" ? <Eye data-icon="inline-start" /> : null}
        {session.status === "closed" ? t("review") : t("details")}
        {session.status === "closed" ? null : (
          <ArrowRight data-icon="inline-end" className="rtl:-scale-x-100" />
        )}
      </Link>
    </Button>
  )
}

export function SessionCardView({ session, today }: { session: SessionCard; today: string }) {
  const t = useTranslations("attendance")
  const f = useFormat()
  const occasionName = useOccasionName()
  const canceled = session.status === "canceled"

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-4 border bg-card p-5",
        session.status === "open" && "border-s-4 border-s-primary",
        canceled && "bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ServiceSwatch tone={session.unit.tone} />
            {session.unit.serviceName}
          </span>
          <h3
            className={cn(
              "font-heading text-lg leading-tight font-semibold",
              canceled && "line-through decoration-1"
            )}
          >
            <bdi>{session.unit.name}</bdi>
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {session.kind === "oneOff" ? <OneOffBadge /> : null}
          <SessionStatusBadge status={session.status} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock className="size-4" aria-hidden="true" />
          {f.timeRange(session.startTime, session.endTime)}
        </span>
        {session.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {session.location}
          </span>
        ) : null}
        {session.changedByHand && session.kind === "recurring" && session.originalDate ? (
          <RescheduledBadge />
        ) : null}
      </div>
      {canceled ? (
        <p className="text-sm text-pretty text-muted-foreground">
          {session.cancelReason ??
            (session.occasion
              ? t("canceledFor", { occasion: occasionName(session.occasion) })
              : t("canceledInPlan"))}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <PresentBar present={session.present} roster={session.roster} />
          <span className="text-sm tabular-nums">
            {session.status === "scheduled"
              ? t("onRoster", { count: session.roster })
              : t("presentOf", { present: session.present, roster: session.roster })}
          </span>
        </div>
      )}
      <div className="mt-auto flex">
        <SessionAction session={session} today={today} />
      </div>
    </article>
  )
}
