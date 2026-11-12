import Link from "next/link"
import { CalendarClock, ListChecks } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { PresentBar } from "@/components/session-card"
import { ServiceSwatch } from "@/components/service-tag"
import { TaskStatusBadge } from "@/components/status"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { getFormat } from "@/i18n/server"
import { getTasks } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("tasks") }
}

export default async function TasksPage() {
  const groups = getTasks(await getStaffContext())
  const t = await getTranslations("tasks")
  const tl = await getTranslations("lessons")
  const f = await getFormat()

  return (
    <>
      <Topbar crumbs={[{ label: tl("crumb") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        {groups.length === 0 ? (
          <Empty className="border border-dashed py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks />
              </EmptyMedia>
              <EmptyTitle>{t("noGroups")}</EmptyTitle>
              <EmptyDescription>{t("noGroupsHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {groups.map((g) => (
          <section
            key={`${g.unit.serviceId}-${g.unit.stageId}`}
            className="flex flex-col gap-3"
            aria-label={g.unit.name}
          >
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <ServiceSwatch tone={g.unit.tone} className="size-2.5" />
              <bdi>{g.unit.name}</bdi>
            </h2>
            {g.tasks.length === 0 ? (
              <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
                {t("none")}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {g.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/lessons/tasks/${task.id}`}
                      className="flex h-full flex-col gap-3 border bg-card p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">
                            <bdi>{task.title}</bdi>
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {t("forLesson", { lesson: task.lesson })}
                          </span>
                        </span>
                        <TaskStatusBadge status={task.status} />
                      </span>
                      <span className="mt-auto flex flex-col gap-1.5">
                        <span className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" aria-hidden="true" />
                            {task.dueDate
                              ? t("due", { date: f.dayMonth(task.dueDate) })
                              : t("noDue")}
                          </span>
                          {task.status === "published" ? (
                            <span className="tabular-nums">
                              {t("doneOf", { done: task.done, total: task.total })}
                            </span>
                          ) : null}
                        </span>
                        {task.status === "published" ? (
                          <PresentBar present={task.done} roster={task.total} />
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {g.archived > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("archivedCount", { count: g.archived })}
              </p>
            ) : null}
          </section>
        ))}
      </PageBody>
    </>
  )
}
