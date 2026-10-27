import type { LucideIcon } from "lucide-react"
import { Ban, CalendarClock, CheckCheck, CircleDashed, MoveRight, Sparkle } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import type { SessionStatus } from "@/lib/domain/types"

export type Tone = "success" | "info" | "warning" | "danger" | "neutral" | "muted"

const toneText: Record<Tone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-foreground",
  muted: "text-muted-foreground",
}

const toneSoft: Record<Tone, string> = {
  success: "bg-success-soft",
  info: "bg-info-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  neutral: "bg-muted",
  muted: "bg-muted",
}

/**
 * Sera badges are uppercase text labels. Status always pairs an icon (or the
 * live dot) with the label, so it never relies on colour alone.
 */
export function StatusBadge({
  tone,
  icon: Icon,
  live,
  soft,
  dashed,
  children,
  className,
  title,
}: {
  tone: Tone
  icon?: LucideIcon
  live?: boolean
  soft?: boolean
  dashed?: boolean
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn(
        toneText[tone],
        soft && ["h-6 px-2", toneSoft[tone]],
        dashed && "border-dashed",
        className
      )}
    >
      {live ? <LiveDot /> : Icon ? <Icon data-icon="inline-start" /> : null}
      {children}
    </Badge>
  )
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)} aria-hidden="true">
      <span className="absolute inline-flex size-full animate-live bg-current opacity-60" />
      <span className="relative inline-flex size-2 bg-current" />
    </span>
  )
}

export function SessionStatusBadge({
  status,
  soft,
  className,
  title,
}: {
  status: SessionStatus | "planned"
  soft?: boolean
  className?: string
  title?: string
}) {
  const t = useTranslations("status")
  const props = { soft, className, title }
  switch (status) {
    case "active":
      return (
        <StatusBadge tone="success" live {...props}>
          {t("active")}
        </StatusBadge>
      )
    case "scheduled":
      return (
        <StatusBadge tone="muted" icon={CalendarClock} {...props}>
          {t("scheduled")}
        </StatusBadge>
      )
    case "completed":
      return (
        <StatusBadge tone="neutral" icon={CheckCheck} {...props}>
          {t("completed")}
        </StatusBadge>
      )
    case "canceled":
      return (
        <StatusBadge tone="danger" icon={Ban} {...props}>
          {t("canceled")}
        </StatusBadge>
      )
    case "planned":
      return (
        <StatusBadge tone="muted" icon={CircleDashed} dashed {...props}>
          {t("planned")}
        </StatusBadge>
      )
  }
}

export function MovedBadge({ className }: { className?: string }) {
  const t = useTranslations("status")
  return (
    <StatusBadge tone="info" icon={MoveRight} className={className}>
      {t("moved")}
    </StatusBadge>
  )
}

export function OneOffBadge({ className }: { className?: string }) {
  const t = useTranslations("status")
  return (
    <StatusBadge tone="muted" icon={Sparkle} className={className}>
      {t("oneOff")}
    </StatusBadge>
  )
}
