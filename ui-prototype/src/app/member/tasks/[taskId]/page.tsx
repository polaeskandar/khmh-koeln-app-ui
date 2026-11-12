import { PortalTask } from "@/components/portal/portal-views"
import { getMemberTask } from "@/server/queries/portals"
import { getMemberContext } from "@/server/request"

export default async function MemberTaskPage({ params }: PageProps<"/member/tasks/[taskId]">) {
  const { taskId } = await params
  const data = getMemberTask(await getMemberContext(), taskId)

  return (
    <PortalTask
      task={data.task}
      lesson={data.lesson}
      personId={data.personId}
      childName={null}
      backHref="/member/tasks"
      lessonHref={data.lesson ? `/member/lessons/${data.lesson.id}` : null}
    />
  )
}
