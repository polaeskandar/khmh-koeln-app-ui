import { CalendarDays, MapPin } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { Section } from "@/components/page-header"
import { LessonGrid, TaskList } from "@/components/portal/portal-home"
import { ServiceSwatch } from "@/components/service-tag"
import { OneOffBadge } from "@/components/status"
import { getFormat } from "@/i18n/server"
import { getMemberHome } from "@/server/queries/portals"
import { getMemberContext } from "@/server/request"

export default async function MemberHomePage() {
  const data = getMemberHome(await getMemberContext())
  const t = await getTranslations("portal")
  const f = await getFormat()

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("hello", { name: data.firstName })}
        </h1>
        <ul className="flex flex-wrap gap-2">
          {data.units.map((u) => (
            <li
              key={`${u.serviceId}-${u.stageId}`}
              className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-sm"
            >
              <ServiceSwatch tone={u.tone} />
              <bdi>{u.name}</bdi>
            </li>
          ))}
        </ul>
      </div>
      <Section title={t("yourTasks")}>
        <TaskList
          tasks={data.open}
          hrefFor={(id) => `/member/tasks/${id}`}
          empty={t("allDoneSelf")}
        />
      </Section>
      <Section title={t("nextSessions")}>
        <ul className="divide-y border">
          {data.sessions.map((x) => (
            <li
              key={x.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3",
                x.canceled && "text-muted-foreground"
              )}
            >
              <span className="inline-flex w-36 items-center gap-1.5 text-sm tabular-nums">
                <CalendarDays className="size-4" aria-hidden="true" />
                {f.dayMonth(x.date)}, {x.startTime}
              </span>
              <span
                className={cn(
                  "flex flex-1 items-center gap-2 font-medium",
                  x.canceled && "line-through"
                )}
              >
                <ServiceSwatch tone={x.unit.tone} />
                <bdi>{x.unit.name}</bdi>
              </span>
              {x.location ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {x.location}
                </span>
              ) : null}
              {x.oneOff ? <OneOffBadge /> : null}
              {x.canceled ? (
                <span className="text-xs font-semibold text-destructive uppercase">
                  {t("canceled")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("recentLessons")}>
        <LessonGrid lessons={data.lessons.slice(0, 4)} hrefFor={(id) => `/member/lessons/${id}`} />
      </Section>
    </>
  )
}
