import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { ServiceTag } from "@/components/service-tag"
import { LessonEditor } from "@/features/lessons/lesson-editor"
import { stageBase } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getLessonForm } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"
import { isolate } from "@/lib/bidi"

export async function generateMetadata() {
  const t = await getTranslations("lessons")
  return { title: t("editLesson") }
}

export default async function EditLessonPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/lessons/[lessonId]/edit">) {
  const { serviceId, stageId, lessonId } = await params
  const form = await getLessonForm(await getStaffContext(), serviceId, stageId, lessonId)
  if (!form?.lesson) notFound()
  const [t, tc] = await Promise.all([getTranslations("lessons"), getTranslations("common")])
  const base = `${stageBase(form)}/lessons`
  const lesson = form.lesson
  return (
    <>
      <StageCrumbsTopbar
        h={form}
        tab="lessons"
        extra={[{ label: lesson.title, href: `${base}/${lesson.id}` }, { label: tc("edit") }]}
      />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={form.service} />
              <span className="text-muted-foreground">· {form.stage.name}</span>
            </>
          }
          title={t("editTitle", { title: isolate(lesson.title) })}
        />
        {!form.can.manage ? (
          <NoAccess
            title={t("noAccess.changeTitle")}
            back={{ href: `${base}/${lesson.id}`, label: t("backToLesson") }}
          >
            {t("noAccess.changeBody", { stage: form.stage.name })}
          </NoAccess>
        ) : lesson.archivedAt ? (
          <NoAccess
            title={t("noAccess.archivedTitle")}
            back={{ href: `${base}/${lesson.id}`, label: t("backToLesson") }}
          >
            {t("noAccess.archivedBody")}
          </NoAccess>
        ) : (
          // Next.js keeps visited pages mounted; a new version starts a fresh form.
          <LessonEditor key={form.version} form={form} base={base} />
        )}
      </PageBody>
    </>
  )
}
