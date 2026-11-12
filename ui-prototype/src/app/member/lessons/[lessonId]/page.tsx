import { PortalLesson } from "@/components/portal/portal-views"
import { getMemberLesson } from "@/server/queries/portals"
import { getMemberContext } from "@/server/request"

export default async function MemberLessonPage({
  params,
}: PageProps<"/member/lessons/[lessonId]">) {
  const { lessonId } = await params
  const ctx = await getMemberContext()
  const data = getMemberLesson(ctx, lessonId)

  return (
    <PortalLesson
      lesson={data.lesson}
      tasks={data.tasks}
      personId={ctx.viewer.personId}
      childName={null}
      backHref="/member/lessons"
      taskHref={(id) => `/member/tasks/${id}`}
    />
  )
}
