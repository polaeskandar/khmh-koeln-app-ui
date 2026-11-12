import { PortalLesson } from "@/components/portal/portal-views"
import { getParentLesson } from "@/server/queries/portals"
import { getParentContext } from "@/server/request"

export default async function ParentLessonPage({
  params,
  searchParams,
}: PageProps<"/parent/lessons/[lessonId]">) {
  const { lessonId } = await params
  const query = await searchParams
  const data = getParentLesson(
    await getParentContext(),
    lessonId,
    typeof query.child === "string" ? query.child : null
  )
  const q = `?child=${data.child.id}`

  return (
    <PortalLesson
      lesson={data.lesson}
      tasks={data.tasks}
      personId={data.child.id}
      childName={data.child.firstName}
      backHref={`/parent/lessons${q}`}
      taskHref={(id) => `/parent/tasks/${id}${q}`}
    />
  )
}
