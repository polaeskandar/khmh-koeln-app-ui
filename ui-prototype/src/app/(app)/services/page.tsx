import Link from "next/link"
import { CalendarDays, ChevronRight, Layers, Rows3, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { NewServiceDialog } from "@/features/services/new-service-dialog"
import { getFormat } from "@/i18n/server"
import { getServices } from "@/server/queries/services"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("services") }
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const archived = (await searchParams).show === "archived"
  const data = getServices(await getStaffContext(), archived)
  const t = await getTranslations("services")
  const f = await getFormat()

  return (
    <>
      <Topbar crumbs={[{ label: t("title") }]} />
      <PageBody>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/services/calendar">
                  <CalendarDays data-icon="inline-start" />
                  {t("calendar")}
                </Link>
              </Button>
              {data.canCreate ? <NewServiceDialog /> : null}
            </>
          }
        />
        {data.archivedCount > 0 ? (
          <LinkTabs
            label={t("title")}
            active={archived ? "archived" : "active"}
            items={[
              { key: "active", href: "/services", label: t("active") },
              {
                key: "archived",
                href: "/services?show=archived",
                label: t("archived"),
                count: data.archivedCount,
              },
            ]}
          />
        ) : null}
        {data.services.length === 0 ? (
          <Empty className="border border-dashed py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers />
              </EmptyMedia>
              <EmptyTitle>{archived ? t("noArchived") : t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.services.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/services/${x.id}`}
                  className="group flex h-full flex-col gap-4 border bg-card p-5 transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center text-white"
                      style={{ background: `var(--identity-${x.tone})` }}
                      aria-hidden="true"
                    >
                      {x.structure === "stages" ? (
                        <Layers className="size-5" />
                      ) : (
                        <Rows3 className="size-5" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="font-heading text-lg leading-tight font-semibold">
                        <bdi>{x.name}</bdi>
                      </h2>
                      {x.description ? (
                        <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                          {x.description}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                  </div>
                  {x.structure === "stages" ? (
                    <ul
                      className="flex flex-wrap gap-1.5"
                      aria-label={t("stagesOf", { name: x.name })}
                    >
                      {x.stages.map((st) => (
                        <li key={st.id} className="border bg-muted/40 px-2 py-0.5 text-xs">
                          {st.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("noStages")}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UsersRound className="size-3.5" aria-hidden="true" />
                      {t("members", { count: x.members })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {x.next
                        ? t("next", { when: `${f.dayMonth(x.next.date)}, ${x.next.startTime}` })
                        : t("noNext")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  )
}
