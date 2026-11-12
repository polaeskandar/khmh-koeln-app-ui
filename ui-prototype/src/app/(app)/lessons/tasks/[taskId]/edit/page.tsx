import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { TaskEditor } from "@/features/tasks/task-editor"
import { getTaskEditor } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function EditTaskPage({ params }: PageProps<"/lessons/tasks/[taskId]/edit">) {
  const { taskId } = await params
  const data = getTaskEditor(await getStaffContext(), null, taskId)
  const t = await getTranslations("tasks")

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("title"), href: "/lessons/tasks" },
          { label: data.task!.title, href: `/lessons/tasks/${taskId}` },
          { label: t("edit") },
        ]}
      />
      <PageBody>
        <PageHeader
          title={t("editTitle")}
          description={`${data.unit.name} · ${data.lesson.title}`}
        />
        <TaskEditor lessonId={data.lesson.id} task={data.task} defaultDue={null} />
      </PageBody>
    </>
  )
}
