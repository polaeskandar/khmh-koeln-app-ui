import Link from "next/link"
import { ArrowLeft, BookOpenText, CalendarClock, ExternalLink } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { LessonReading } from "@/components/lesson-content"
import { ServiceSwatch } from "@/components/service-tag"
import { getFormat } from "@/i18n/server"
import type { PublishedLesson } from "@/server/queries/portals"

import { TaskDoneToggle } from "./task-done-toggle"

type TaskView = {
  id: string
  title: string
  instructions: string
  dueDate: string | null
  resources: { label: string; url: string | null }[]
  lessonId: string
  lessonTitle: string
  doneAt: string | null
  doneBy: string | null
}

export async function PortalLesson({
  lesson,
  tasks,
  personId,
  childName,
  backHref,
  taskHref,
}: {
  lesson: PublishedLesson
  tasks: TaskView[]
  personId: string
  childName: string | null
  backHref: string
  taskHref: (id: string) => string
}) {
  const t = await getTranslations("portal")
  const f = await getFormat()

  return (
    <article className="flex flex-col gap-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("backToLessons")}
      </Link>
      <header className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <ServiceSwatch tone={lesson.unit.tone} />
          <bdi>{lesson.unit.name}</bdi> · {f.longDate(lesson.date)}
        </span>
        <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance">
          <bdi>{lesson.title}</bdi>
        </h1>
      </header>
      <LessonReading
        summary={lesson.summary}
        objectives={lesson.objectives}
        teachingPoints={lesson.teachingPoints}
        materials={lesson.materials}
      />
      {tasks.length > 0 ? (
        <section aria-labelledby="lesson-tasks" className="flex flex-col gap-3 border-t pt-6">
          <h2 id="lesson-tasks" className="font-heading text-lg font-semibold">
            {childName ? t("tasksFor", { name: childName }) : t("yourTasks")}
          </h2>
          <ul className="flex flex-col gap-3">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-col gap-3 border bg-card p-4">
                <div className="flex flex-col gap-1">
                  <Link href={taskHref(task.id)} className="font-medium hover:underline">
                    <bdi>{task.title}</bdi>
                  </Link>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {task.instructions}
                  </p>
                  {task.dueDate ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      {t("due", { date: f.dayMonth(task.dueDate) })}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TaskDoneToggle
                    taskId={task.id}
                    personId={personId}
                    done={task.doneAt !== null}
                    name={childName}
                  />
                  {task.doneAt ? (
                    <span className="text-sm text-success">
                      {t("doneOn", {
                        date: f.dayMonth(task.doneAt.slice(0, 10)),
                        name: task.doneBy ?? "",
                      })}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}

export async function PortalTask({
  task,
  lesson,
  personId,
  childName,
  backHref,
  lessonHref,
}: {
  task: TaskView
  lesson: { id: string; title: string } | null
  personId: string
  childName: string | null
  backHref: string
  lessonHref: string | null
}) {
  const t = await getTranslations("portal")
  const f = await getFormat()

  return (
    <article className="flex max-w-2xl flex-col gap-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("backToTasks")}
      </Link>
      <header className="flex flex-col gap-2">
        {childName ? (
          <span className="text-sm text-muted-foreground">{t("taskFor", { name: childName })}</span>
        ) : null}
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          <bdi>{task.title}</bdi>
        </h1>
        <span className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {lesson && lessonHref ? (
            <Link href={lessonHref} className="inline-flex items-center gap-1.5 hover:underline">
              <BookOpenText className="size-4" aria-hidden="true" />
              {lesson.title}
            </Link>
          ) : null}
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden="true" />
              {t("due", { date: f.mediumDate(task.dueDate) })}
            </span>
          ) : null}
        </span>
      </header>
      <p className="text-lg leading-relaxed whitespace-pre-line">{task.instructions}</p>
      {task.resources.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {task.resources.map((r) => (
            <li key={r.label}>
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <ExternalLink className="size-4 text-primary" aria-hidden="true" />
                  {r.label}
                </a>
              ) : (
                <span className="text-sm">{r.label}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <TaskDoneToggle
          taskId={task.id}
          personId={personId}
          done={task.doneAt !== null}
          name={childName}
        />
        {task.doneAt ? (
          <span className="text-sm text-success">
            {t("doneOn", { date: f.dayMonth(task.doneAt.slice(0, 10)), name: task.doneBy ?? "" })}
          </span>
        ) : null}
      </div>
    </article>
  )
}
