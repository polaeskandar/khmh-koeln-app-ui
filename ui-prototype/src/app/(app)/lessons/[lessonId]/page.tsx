import Link from "next/link"
import { ArrowRight, CalendarDays, Lock, Pencil, Plus, UserRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LessonReading } from "@/components/lesson-content"
import { PageHeader, Section } from "@/components/page-header"
import { ServiceSwatch } from "@/components/service-tag"
import { LessonStatusBadge, TaskStatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { LessonStatusActions } from "@/features/lessons/lesson-actions"
import { ResponsibleDialog } from "@/features/lessons/responsible-dialog"
import { getFormat } from "@/i18n/server"
import { getLesson } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function LessonPage({ params }: PageProps<"/lessons/[lessonId]">) {
  const { lessonId } = await params
  const data = getLesson(await getStaffContext(), lessonId)
  const { lesson } = data
  const t = await getTranslations("lessons")
  const ta = await getTranslations("access")
  const f = await getFormat()
  const internal = lesson.materials.filter((m) => !m.shared)

  return (
    <>
      <Topbar crumbs={[{ label: t("preparation"), href: "/lessons" }, { label: lesson.title }]} />
      <PageBody>
        <PageHeader
          title={lesson.title}
          meta={
            <>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <ServiceSwatch tone={data.unit.tone} />
                <bdi>{data.unit.name}</bdi>
              </span>
              <LessonStatusBadge status={lesson.status} />
            </>
          }
          actions={
            data.can.edit ? (
              <Button asChild variant="outline">
                <Link href={`/lessons/${lesson.id}/edit`}>
                  <Pencil data-icon="inline-start" />
                  {t("edit")}
                </Link>
              </Button>
            ) : null
          }
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {f.longDate(lesson.date)}
              {data.session ? `, ${data.session.startTime}` : ""}
            </span>
            {data.responsible ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {t("responsible", { name: data.responsible.name })}
              </span>
            ) : null}
          </p>
        </PageHeader>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="flex min-w-0 flex-col gap-8">
            <LessonReading
              summary={lesson.summary}
              objectives={lesson.objectives}
              teachingPoints={lesson.teachingPoints}
              materials={lesson.materials.filter((m) => m.shared)}
            />
            {lesson.notes || internal.length > 0 ? (
              <section
                className="flex flex-col gap-3 border border-dashed bg-muted/30 p-5"
                aria-labelledby="internal"
              >
                <h2
                  id="internal"
                  className="flex items-center gap-2 font-heading text-base font-semibold"
                >
                  <Lock className="size-4" aria-hidden="true" />
                  {t("internal")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("internalHint")}</p>
                {lesson.notes ? (
                  <p className="text-sm whitespace-pre-line">{lesson.notes}</p>
                ) : null}
                {internal.length > 0 ? (
                  <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                    {internal.map((m) => (
                      <li key={m.label}>
                        {m.url ? (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                          >
                            {m.label}
                          </a>
                        ) : (
                          m.label
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </article>
          <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
            <section className="flex flex-col gap-3 border p-4" aria-labelledby="visibility">
              <h2 id="visibility" className="text-xs font-semibold tracking-wider uppercase">
                {t("visibility.title")}
              </h2>
              <p className="text-sm text-pretty text-muted-foreground">
                {lesson.status === "published" ? t("visibility.published") : t("visibility.hidden")}
              </p>
              <LessonStatusActions
                lessonId={lesson.id}
                status={lesson.status}
                canEdit={data.can.edit}
                canDelete={data.can.delete}
                hasTasks={data.tasks.length > 0}
              />
            </section>
            <Section
              title={t("tasksTitle")}
              actions={
                data.can.tasks ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/lessons/tasks/new?lesson=${lesson.id}`}>
                      <Plus data-icon="inline-start" />
                      {t("addTask")}
                    </Link>
                  </Button>
                ) : null
              }
            >
              {data.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
              ) : (
                <ul className="divide-y border">
                  {data.tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/lessons/tasks/${task.id}`}
                        className="flex flex-col gap-1.5 p-3 hover:bg-muted/40"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium">{task.title}</span>
                          <TaskStatusBadge status={task.status} />
                        </span>
                        {task.status === "published" ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("doneOf", { done: task.done, total: task.total })}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title={ta("lesson.title")}>
              <div className="flex flex-col gap-1 border p-3">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {ta("lesson.responsible")}
                </span>
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                    {data.responsible?.name ?? "—"}
                  </span>
                  {data.can.responsible ? (
                    <ResponsibleDialog
                      lessonId={lesson.id}
                      current={data.responsible?.id ?? null}
                      choices={data.responsibleChoices}
                    />
                  ) : null}
                </span>
                <p className="text-xs text-pretty text-muted-foreground">
                  {ta("lesson.responsibleHint")}
                </p>
              </div>
              {data.accessHref ? (
                <Link
                  href={data.accessHref}
                  className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                >
                  {ta("lesson.manage")}
                  <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              ) : null}
            </Section>
          </aside>
        </div>
      </PageBody>
    </>
  )
}
