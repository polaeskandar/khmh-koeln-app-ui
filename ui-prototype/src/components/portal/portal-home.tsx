import { CalendarCheck2, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PortalLessonCard, PortalTaskCard } from "@/components/portal/portal-bits"
import type { PublishedLesson } from "@/server/queries/portals"
import type { UnitRef } from "@/lib/view-models"

type Task = {
  id: string
  title: string
  lessonTitle: string
  dueDate: string | null
  doneAt: string | null
  unit: UnitRef
}

export async function TaskList({
  tasks,
  hrefFor,
  empty,
}: {
  tasks: Task[]
  hrefFor: (id: string) => string
  empty: string
}) {
  if (tasks.length === 0) {
    return (
      <p className="flex items-center gap-2 border border-dashed p-5 text-sm text-muted-foreground">
        <CalendarCheck2 className="size-4" aria-hidden="true" />
        {empty}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <PortalTaskCard
            href={hrefFor(task.id)}
            title={task.title}
            lesson={task.lessonTitle}
            dueDate={task.dueDate}
            doneAt={task.doneAt}
            unit={task.unit}
          />
        </li>
      ))}
    </ul>
  )
}

export async function LessonGrid({
  lessons,
  hrefFor,
}: {
  lessons: (PublishedLesson & { tasks: number })[]
  hrefFor: (id: string) => string
}) {
  const t = await getTranslations("portal")

  if (lessons.length === 0) {
    return (
      <p className="flex items-center gap-2 border border-dashed p-5 text-sm text-muted-foreground">
        <Sparkles className="size-4" aria-hidden="true" />
        {t("noLessons")}
      </p>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {lessons.map((l) => (
        <li key={l.id}>
          <PortalLessonCard
            href={hrefFor(l.id)}
            title={l.title}
            summary={l.summary}
            date={l.date}
            unit={l.unit}
            tasks={l.tasks}
          />
        </li>
      ))}
    </ul>
  )
}
