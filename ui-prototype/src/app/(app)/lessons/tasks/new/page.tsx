import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { TaskEditor } from "@/features/tasks/task-editor"
import { addDays } from "@/lib/domain/time"
import { getTaskEditor } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function NewTaskPage({ searchParams }: PageProps<"/lessons/tasks/new">) {
  const query = await searchParams
  const data = getTaskEditor(
    await getStaffContext(),
    typeof query.lesson === "string" ? query.lesson : null,
    null
  )
  const t = await getTranslations("tasks")

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("title"), href: "/lessons/tasks" },
          { label: data.lesson.title, href: `/lessons/${data.lesson.id}` },
          { label: t("new") },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("newTitle")}
          description={`${data.unit.name} · ${data.lesson.title}`}
        />
        <TaskEditor
          lessonId={data.lesson.id}
          task={null}
          defaultDue={addDays(data.lesson.date, 7)}
        />
      </PageBody>
    </>
  )
}
