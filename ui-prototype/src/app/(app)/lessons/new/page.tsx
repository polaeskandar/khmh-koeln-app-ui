import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { LessonEditor } from "@/features/lessons/lesson-editor"
import { getLessonEditor } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function NewLessonPage({ searchParams }: PageProps<"/lessons/new">) {
  const query = await searchParams

  if (typeof query.service !== "string") {
    notFound()
  }

  const unit = {
    serviceId: query.service,
    stageId: typeof query.stage === "string" ? query.stage : null,
  }
  const data = getLessonEditor(await getStaffContext(), unit, null)
  const t = await getTranslations("lessons")

  return (
    <>
      <Topbar crumbs={[{ label: t("preparation"), href: "/lessons" }, { label: t("new") }]} />
      <PageBody>
        <PageHeader title={t("newTitle")} description={data.unit.name} />
        <LessonEditor unit={unit} lesson={null} sessions={data.sessions} />
      </PageBody>
    </>
  )
}
