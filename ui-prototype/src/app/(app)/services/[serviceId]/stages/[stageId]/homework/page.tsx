import Link from "next/link"
import { notFound } from "next/navigation"
import { Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { HomeworkTable } from "@/features/homework/homework-table"
import { stageBase, StageHeader } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getStageHomework } from "@/server/queries/learning"
import { getStageHeader } from "@/server/queries/stage"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("homework")
  return { title: t("title") }
}

export default async function StageHomeworkPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/homework">) {
  const { serviceId, stageId } = await params
  const ctx = await getStaffContext()
  const [h, d, t] = await Promise.all([
    getStageHeader(ctx, serviceId, stageId),
    getStageHomework(ctx, serviceId, stageId),
    getTranslations("homework"),
  ])
  if (!h || !d) notFound()
  const base = stageBase(h)
  return (
    <>
      <StageCrumbsTopbar h={h} tab="homework" />
      <PageBody>
        <StageHeader h={h} active="homework" />
        <Section
          id="homework"
          title={t("title")}
          description={t("list.description", { stage: h.stage.name })}
          actions={
            d.can.manage && d.lessons.length > 0 ? (
              <Button asChild>
                <Link href={`${base}/homework/new`}>
                  <Plus data-icon="inline-start" />
                  {t("newHomework")}
                </Link>
              </Button>
            ) : null
          }
        >
          <HomeworkTable rows={d.rows} today={d.today} stageBase={base} canManage={d.can.manage} />
          {d.can.manage && d.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.rich("list.needsLesson", {
                link: (chunks) => (
                  <Link href={`${base}/lessons/new`} className="underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : null}
        </Section>
      </PageBody>
    </>
  )
}
