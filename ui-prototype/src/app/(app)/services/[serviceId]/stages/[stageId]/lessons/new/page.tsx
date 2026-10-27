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

export async function generateMetadata() {
  const t = await getTranslations("lessons")
  return { title: t("newLesson") }
}

export default async function NewLessonPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/lessons/new">) {
  const { serviceId, stageId } = await params
  const form = await getLessonForm(await getStaffContext(), serviceId, stageId)
  if (!form) notFound()
  const t = await getTranslations("lessons")
  const base = `${stageBase(form)}/lessons`
  return (
    <>
      <StageCrumbsTopbar h={form} tab="lessons" extra={[{ label: t("newLesson") }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={form.service} />
              <span className="text-muted-foreground">· {form.stage.name}</span>
            </>
          }
          title={t("newLesson")}
          description={t("newDescription")}
        />
        {form.can.manage ? (
          // Next.js keeps visited pages mounted; a new version starts a fresh form.
          <LessonEditor key={form.version} form={form} base={base} />
        ) : (
          <NoAccess
            title={t("noAccess.prepareTitle")}
            back={{ href: base, label: t("backToLessons") }}
          >
            {t("noAccess.prepareBody", { stage: form.stage.name })}
          </NoAccess>
        )}
      </PageBody>
    </>
  )
}
