import Link from "next/link"
import { notFound } from "next/navigation"
import { Info, Pencil } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { CompletionTable } from "@/features/homework/completion-table"
import { HomeworkActionsMenu, PublishHomeworkButton } from "@/features/homework/homework-actions"
import { DueLine } from "@/features/homework/homework-bits"
import { CompletionMeter, HomeworkStatusBadge } from "@/features/lessons/lesson-bits"
import { VisibilityNote } from "@/features/lessons/visibility"
import { stageBase } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getFormat } from "@/i18n/server"
import { getHomeworkProgress } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("homework")
  return { title: t("title") }
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export default async function HomeworkProgressPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/homework/[homeworkId]">) {
  const { serviceId, stageId, homeworkId } = await params
  const [d, t, tc, f] = await Promise.all([
    getHomeworkProgress(await getStaffContext(), serviceId, stageId, homeworkId),
    getTranslations("homework"),
    getTranslations("common"),
    getFormat(),
  ])
  if (!d) notFound()
  const base = stageBase(d)
  if (d.forbidden) {
    return (
      <>
        <StageCrumbsTopbar h={d} tab="homework" />
        <PageBody>
          <NoAccess
            title={t("progress.noAccessTitle")}
            back={{ href: `${base}/homework`, label: t("backToList") }}
          >
            {t("progress.noAccess", { stage: d.stage.name })}
          </NoAccess>
        </PageBody>
      </>
    )
  }
  const hw = d.homework
  const counts = hw.counts
  const target = {
    id: hw.id,
    title: hw.title,
    status: hw.status,
    publishedAt: hw.publishedAt,
    completed: counts?.completed ?? 0,
  }
  return (
    <>
      <StageCrumbsTopbar h={d} tab="homework" extra={[{ label: hw.title }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <HomeworkStatusBadge status={hw.status} />
              <DueLine dueDate={hw.dueDate} today={d.today} className="text-sm" />
              <span className="text-muted-foreground">
                ·{" "}
                {t.rich("progress.lessonOn", {
                  lesson: d.lesson.title,
                  date: f.relativeDay(d.lesson.teachingDate, d.today),
                  link: (chunks) => (
                    <Link
                      href={`${base}/lessons/${d.lesson.id}`}
                      className="underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </>
          }
          title={hw.title}
          actions={
            d.can.manage ? (
              <>
                {hw.status !== "archived" ? (
                  <Button variant="outline" asChild>
                    <Link href={`${base}/homework/${hw.id}/edit`}>
                      <Pencil data-icon="inline-start" />
                      {tc("edit")}
                    </Link>
                  </Button>
                ) : null}
                <PublishHomeworkButton hw={target} />
                <HomeworkActionsMenu
                  hw={target}
                  stageBase={base}
                  showProgress={false}
                  afterDelete={`${base}/homework`}
                />
              </>
            ) : null
          }
        />

        <p className="flex items-start gap-2 bg-info-soft p-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("progress.note")}</span>
        </p>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-6">
            {counts ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Figure
                  label={t("progress.childrenIn", { stage: d.stage.name })}
                  value={counts.assigned}
                />
                <Figure
                  label={t("progress.reportedDone")}
                  value={counts.completed}
                  hint={
                    counts.late > 0 ? t("progress.afterDue", { count: counts.late }) : undefined
                  }
                />
                <Figure label={t("notYet")} value={counts.notCompleted} />
                <Figure
                  label={t("progress.withoutAccount")}
                  value={counts.withoutParentAccount}
                  hint={t("progress.cantReportOnline")}
                />
              </div>
            ) : (
              <p className="border border-dashed p-4 text-sm text-muted-foreground">
                {t("progress.draftNote")}
              </p>
            )}
            <CompletionTable rows={d.rows} today={d.today} stageName={d.stage.name} />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-3 border border-s-4 border-s-success p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-base font-semibold tracking-tight">
                  {t("progress.whatParentsRead")}
                </h2>
                <VisibilityNote who="parents" />
              </div>
              <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                {hw.instructions}
              </p>
              {hw.resources.length > 0 ? (
                <ul dir="auto" className="flex flex-col gap-1 text-sm">
                  {hw.resources.map((r, i) => (
                    <li key={i}>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          {r.label}
                        </a>
                      ) : (
                        r.label
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            {counts && counts.assigned > 0 ? (
              <div className="border p-5">
                <CompletionMeter completed={counts.completed} assigned={counts.assigned} />
              </div>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  )
}
