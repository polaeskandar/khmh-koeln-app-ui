import Link from "next/link"
import { BookOpenText, ListChecks, Plus, UserRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { LessonStatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getFormat } from "@/i18n/server"
import { getPreparation } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("preparation") }
}

type Summary = ReturnType<typeof getPreparation>[number]["upcoming"][number]

async function LessonLink({ lesson, viewerId }: { lesson: Summary; viewerId: string }) {
  const f = await getFormat()
  const t = await getTranslations("lessons")

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex w-12 shrink-0 flex-col items-center leading-none">
        <span className="font-heading text-lg font-semibold tabular-nums">
          {f.dayOfMonth(lesson.date)}
        </span>
        <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
          {f.monthShort(lesson.date)}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          <bdi>{lesson.title}</bdi>
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {lesson.responsible && lesson.responsible.id !== viewerId ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden="true" />
              {t("responsible", { name: lesson.responsible.name })}
            </span>
          ) : null}
          {lesson.tasks > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" aria-hidden="true" />
              {t("tasks", { count: lesson.tasks })}
            </span>
          ) : null}
        </span>
      </span>
      <LessonStatusBadge status={lesson.status} />
    </Link>
  )
}

export default async function PreparationPage() {
  const ctx = await getStaffContext()
  const groups = getPreparation(ctx)
  const t = await getTranslations("lessons")

  return (
    <>
      <Topbar crumbs={[{ label: t("crumb") }, { label: t("preparation") }]} />
      <PageBody>
        <PageHeader title={t("preparation")} description={t("preparationHint")} />
        {groups.length === 0 ? (
          <Empty className="border border-dashed py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenText />
              </EmptyMedia>
              <EmptyTitle>{t("noGroups")}</EmptyTitle>
              <EmptyDescription>{t("noGroupsHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section
              key={`${g.unit.serviceId}-${g.unit.stageId}`}
              className="flex flex-col gap-3"
              aria-label={g.unit.name}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <ServiceSwatch tone={g.unit.tone} className="size-2.5" />
                  <bdi>{g.unit.name}</bdi>
                </h2>
                {g.canCreate ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/lessons/new?service=${g.unit.serviceId}${g.unit.stageId ? `&stage=${g.unit.stageId}` : ""}`}
                    >
                      <Plus data-icon="inline-start" />
                      {t("new")}
                    </Link>
                  </Button>
                ) : null}
              </div>
              <div className="border bg-card">
                {g.upcoming.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">{t("nothingPlanned")}</p>
                ) : (
                  <ul className="divide-y">
                    {g.upcoming.map((l) => (
                      <li key={l.id}>
                        <LessonLink lesson={l} viewerId={ctx.viewer.id} />
                      </li>
                    ))}
                  </ul>
                )}
                {g.earlier.length > 0 ? (
                  <details className="border-t">
                    <summary className="cursor-pointer px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("earlier", { count: g.earlier.length })}
                    </summary>
                    <ul className="divide-y border-t">
                      {g.earlier.map((l) => (
                        <li key={l.id}>
                          <LessonLink lesson={l} viewerId={ctx.viewer.id} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </PageBody>
    </>
  )
}
