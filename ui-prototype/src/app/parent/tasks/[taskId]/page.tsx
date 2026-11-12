import { PortalTask } from "@/components/portal/portal-views"
import { getParentTask } from "@/server/queries/portals"
import { getParentContext } from "@/server/request"

export default async function ParentTaskPage({
  params,
  searchParams,
}: PageProps<"/parent/tasks/[taskId]">) {
  const { taskId } = await params
  const query = await searchParams
  const data = getParentTask(
    await getParentContext(),
    taskId,
    typeof query.child === "string" ? query.child : null
  )
  const q = `?child=${data.child.id}`

  return (
    <PortalTask
      task={data.task}
      lesson={data.lesson}
      personId={data.child.id}
      childName={data.child.firstName}
      backHref={`/parent/tasks${q}`}
      lessonHref={data.lesson ? `/parent/lessons/${data.lesson.id}${q}` : null}
    />
  )
}
