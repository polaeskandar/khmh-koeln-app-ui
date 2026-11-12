import { cookies } from "next/headers"
import { CalendarCheck2 } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { SessionCardView } from "@/components/session-card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PlanningReminder } from "@/features/home/planning-reminder"
import { getFormat } from "@/i18n/server"
import { getHome } from "@/server/queries/home"
import { viewerInfo } from "@/server/queries/present"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")

  return { title: t("home") }
}

export default async function HomePage() {
  const ctx = await getStaffContext()
  const store = await cookies()
  const postponed = store
    .getAll()
    .filter((c) => c.name.startsWith("khmk-planning-later-"))
    .map((c) => Number(c.name.slice("khmk-planning-later-".length)))
  const home = getHome(ctx, postponed)
  const t = await getTranslations("home")
  const f = await getFormat()
  const viewer = viewerInfo(ctx.state, ctx.viewer)

  return (
    <>
      <Topbar crumbs={[{ label: (await getTranslations("nav"))("home") }]} />
      <PageBody>
        <PageHeader
          title={t(`greeting.${home.partOfDay}`, { name: viewer.firstName })}
          description={`${f.longDate(home.today)} · ${f.copticDate(home.today)}`}
        />
        {home.reminders.map((r) => (
          <PlanningReminder
            key={r.year}
            reminder={{
              year: r.year,
              services: r.services.map((x) => ({
                ...x,
                tone: ctx.state.serviceTones[x.serviceId] ?? 1,
              })),
            }}
          />
        ))}
        <Section
          title={t("today")}
          description={home.sessions.length > 0 ? t("todayHint") : undefined}
        >
          {home.sessions.length === 0 ? (
            <Empty className="border border-dashed py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarCheck2 />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {home.sessions.map((x) => (
                <SessionCardView key={x.id} session={x} today={home.today} />
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </>
  )
}
