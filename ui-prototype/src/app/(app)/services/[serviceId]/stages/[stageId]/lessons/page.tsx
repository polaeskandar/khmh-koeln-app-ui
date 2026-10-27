import Link from "next/link"
import { notFound } from "next/navigation"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { LessonsBrowser } from "@/features/lessons/lessons-browser"
import { stageBase, StageHeader } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getStageLessons } from "@/server/queries/learning"
import { getStageHeader } from "@/server/queries/stage"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("lessons")
  return { title: t("title") }
}

export default async function LessonsPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/lessons">) {
  const { serviceId, stageId } = await params
  const ctx = await getStaffContext()
  const h = await getStageHeader(ctx, serviceId, stageId)
  const d = await getStageLessons(ctx, serviceId, stageId)
  if (!h || !d) notFound()
  const t = await getTranslations("lessons")
  const base = `${stageBase(h)}/lessons`
  return (
    <>
      <StageCrumbsTopbar h={h} tab="lessons" />
      <PageBody>
        <StageHeader h={h} active="lessons" />
        <Section
          id="lessons"
          title={t("list.sectionTitle")}
          description={t("list.sectionDescription")}
          actions={
            d.can.manage ? (
              <Button asChild>
                <Link href={`${base}/new`}>
                  <Plus data-icon="inline-start" />
                  {t("newLesson")}
                </Link>
              </Button>
            ) : null
          }
        >
          <LessonsBrowser
            base={base}
            upcoming={d.upcoming}
            previous={d.previous}
            archived={d.archived}
            servants={d.servants}
            today={d.today}
            canManage={d.can.manage}
          />
        </Section>
      </PageBody>
    </>
  )
}
