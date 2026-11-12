"use client"

import Link from "next/link"
import { useTransition } from "react"
import { CalendarPlus } from "lucide-react"
import { useTranslations } from "next-intl"

import { ServiceSwatch } from "@/components/service-tag"
import { Button } from "@/components/ui/button"
import { postponePlanningAction } from "@/server/actions/settings"

export type Reminder = {
  year: number
  services: { serviceId: string; name: string; missing: number; drafts: number; tone: number }[]
}

export function PlanningReminder({ reminder }: { reminder: Reminder }) {
  const t = useTranslations("home.planning")
  const [pending, start] = useTransition()
  const first = reminder.services[0]

  return (
    <section
      aria-labelledby={`planning-${reminder.year}`}
      className="flex flex-col gap-4 border border-warning/40 bg-warning-soft/40 p-5 md:flex-row md:items-start md:justify-between"
    >
      <div className="flex gap-3">
        <CalendarPlus className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h2 id={`planning-${reminder.year}`} className="font-heading font-semibold">
            {t("title", { year: String(reminder.year) })}
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {reminder.services.map((x) => (
              <li key={x.serviceId} className="flex items-center gap-2">
                <ServiceSwatch tone={x.tone} />
                <Link
                  href={`/services/${x.serviceId}?tab=schedule&year=${reminder.year}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {x.name}
                </Link>
                <span>
                  {x.missing > 0 ? t("missing", { count: x.missing }) : null}
                  {x.missing > 0 && x.drafts > 0 ? " · " : null}
                  {x.drafts > 0 ? t("drafts", { count: x.drafts }) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => start(() => postponePlanningAction(reminder.year))}
        >
          {t("later")}
        </Button>
        <Button asChild>
          <Link href={`/services/${first.serviceId}?tab=schedule&year=${reminder.year}`}>
            {t("prepare")}
          </Link>
        </Button>
      </div>
    </section>
  )
}
