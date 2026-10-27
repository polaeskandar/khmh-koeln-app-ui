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
import { isolate } from "@/lib/bidi"

export async function generateMetadata() {
  const t = await getTranslations("homework")
  return { title: t("editHomework") }
}

export default async function EditHomeworkPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/homework/[homeworkId]/edit">) {
  const { serviceId, stageId, homeworkId } = await params
  const [editor, t, tc] = await Promise.all([
    getHomeworkEditor(await getStaffContext(), serviceId, stageId, { homeworkId }),
    getTranslations("homework"),
    getTranslations("common"),
  ])
  if (!editor?.homework) notFound()
  const base = stageBase(editor)
  const hw = editor.homework
  return (
    <>
      <StageCrumbsTopbar
        h={editor}
        tab="homework"
        extra={[
          {
            label: hw.title,
            href: hw.status === "draft" ? undefined : `${base}/homework/${hw.id}`,
          },
          { label: tc("edit") },
        ]}
      />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={editor.service} />
              <span className="text-muted-foreground">· {editor.stage.name}</span>
            </>
          }
          title={t("edit.title", { title: isolate(hw.title) })}
        />
        {!editor.can.manage ? (
          <NoAccess
            title={t("edit.noAccessTitle")}
            back={{ href: `${base}/homework`, label: t("backToList") }}
          >
            {t("edit.noAccess", { stage: editor.stage.name })}
          </NoAccess>
        ) : hw.status === "archived" ? (
          <NoAccess
            title={t("edit.archivedTitle")}
            back={{ href: `${base}/homework/${hw.id}`, label: t("edit.backToHomework") }}
          >
            {t("edit.archived")}
          </NoAccess>
        ) : (
          <HomeworkEditorForm key={editor.version} editor={editor} stageBase={base} />
        )}
      </PageBody>
    </>
  )
}
