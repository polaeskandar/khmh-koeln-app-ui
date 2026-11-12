import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { LessonEditor } from "@/features/lessons/lesson-editor"
import { getLessonEditor, lessonFor } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function EditLessonPage({ params }: PageProps<"/lessons/[lessonId]/edit">) {
  const { lessonId } = await params
  const ctx = await getStaffContext()
  const lesson = lessonFor(ctx, lessonId)
  const data = getLessonEditor(
    ctx,
    { serviceId: lesson.serviceId, stageId: lesson.stageId },
    lesson.id
  )
  const t = await getTranslations("lessons")

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("preparation"), href: "/lessons" },
          { label: lesson.title, href: `/lessons/${lesson.id}` },
          { label: t("edit") },
        ]}
      />
      <PageBody>
        <PageHeader title={t("editTitle")} description={data.unit.name} />
        <LessonEditor
          unit={{ serviceId: lesson.serviceId, stageId: lesson.stageId }}
          lesson={data.lesson}
          sessions={data.sessions}
        />
      </PageBody>
    </>
  )
}
