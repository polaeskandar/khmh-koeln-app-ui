import Link from "next/link"
import { BookOpenText, CalendarClock, CheckCircle2, ChevronRight, Circle } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ServiceSwatch } from "@/components/service-tag"
import { useFormat } from "@/i18n/format"
import type { UnitRef } from "@/lib/view-models"

export function ChildSwitcher({
  kids,
  selected,
  hrefFor,
}: {
  kids: { id: string; firstName: string; groups: string[] }[]
  selected: string | null
  hrefFor: (childId: string) => string
}) {
  const t = useTranslations("portal")

  if (kids.length <= 1) {
    return null
  }

  return (
    <nav aria-label={t("chooseChild")} className="flex flex-wrap gap-2">
      {kids.map((c) => (
        <Link
          key={c.id}
          href={hrefFor(c.id)}
          aria-current={c.id === selected ? "page" : undefined}
          className={cn(
            "flex flex-col border px-4 py-2 text-start hover:bg-muted/50",
            c.id === selected && "border-primary bg-primary/5 ring-1 ring-primary"
          )}
        >
          <span className="font-medium">{c.firstName}</span>
          <span className="text-xs text-muted-foreground">{c.groups.join(" · ")}</span>
        </Link>
      ))}
    </nav>
  )
}

export function PortalTaskCard({
  href,
  title,
  lesson,
  dueDate,
  doneAt,
  unit,
}: {
  href: string
  title: string
  lesson: string
  dueDate: string | null
  doneAt: string | null
  unit: UnitRef
}) {
  const t = useTranslations("portal")
  const f = useFormat()

  return (
    <Link
      href={href}
      className="flex items-center gap-4 border bg-card p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {doneAt ? (
        <CheckCircle2 className="size-6 shrink-0 text-success" aria-label={t("done")} />
      ) : (
        <Circle className="size-6 shrink-0 text-muted-foreground" aria-label={t("open")} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("font-medium", doneAt && "text-muted-foreground line-through")}>
          <bdi>{title}</bdi>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ServiceSwatch tone={unit.tone} />
            {lesson}
          </span>
          {dueDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {t("due", { date: f.dayMonth(dueDate) })}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
        aria-hidden="true"
      />
    </Link>
  )
}

export function PortalLessonCard({
  href,
  title,
  summary,
  date,
  unit,
  tasks,
}: {
  href: string
  title: string
  summary: string | null
  date: string
  unit: UnitRef
  tasks: number
}) {
  const t = useTranslations("portal")
  const f = useFormat()

  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-2 border bg-card p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpenText className="size-3.5" aria-hidden="true" />
        {f.dayMonth(date)} · <bdi>{unit.name}</bdi>
      </span>
      <span className="font-heading text-base font-semibold">
        <bdi>{title}</bdi>
      </span>
      {summary ? (
        <span className="line-clamp-2 text-sm text-muted-foreground">{summary}</span>
      ) : null}
      {tasks > 0 ? (
        <span className="mt-auto text-xs font-medium text-primary">
          {t("tasks", { count: tasks })}
        </span>
      ) : null}
    </Link>
  )
}
