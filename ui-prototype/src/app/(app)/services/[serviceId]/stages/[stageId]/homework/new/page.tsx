import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { ServiceTag } from "@/components/service-tag"
import { HomeworkEditorForm } from "@/features/homework/homework-editor"
import { stageBase } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getHomeworkEditor } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("homework")
  return { title: t("newHomework") }
}

export default async function NewHomeworkPage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/stages/[stageId]/homework/new">) {
  const { serviceId, stageId } = await params
  const { lesson } = await searchParams
  const [editor, t] = await Promise.all([
    getHomeworkEditor(await getStaffContext(), serviceId, stageId, {
      lessonId: typeof lesson === "string" ? lesson : undefined,
    }),
    getTranslations("homework"),
  ])
  if (!editor) notFound()
  const base = stageBase(editor)
  return (
    <>
      <StageCrumbsTopbar h={editor} tab="homework" extra={[{ label: t("newHomework") }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={editor.service} />
              <span className="text-muted-foreground">· {editor.stage.name}</span>
            </>
          }
          title={t("newHomework")}
          description={t("new.description")}
        />
        {!editor.can.manage ? (
          <NoAccess
            title={t("new.noAccessTitle")}
            back={{ href: `${base}/homework`, label: t("backToList") }}
          >
            {t("new.noAccess", { stage: editor.stage.name })}
          </NoAccess>
        ) : editor.lessons.length === 0 ? (
          <NoAccess
            title={t("new.lessonFirstTitle")}
            back={{ href: `${base}/lessons/new`, label: t("new.newLesson") }}
          >
            {t("new.lessonFirst")}
          </NoAccess>
        ) : (
          <HomeworkEditorForm key={editor.version} editor={editor} stageBase={base} />
        )}
      </PageBody>
    </>
  )
}
