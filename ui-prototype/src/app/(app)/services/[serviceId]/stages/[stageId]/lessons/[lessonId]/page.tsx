import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Plus } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { MemberAvatar } from "@/components/member-avatar"
import { PageHeader, Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { HomeworkListItem } from "@/features/homework/homework-bits"
import { LessonActions } from "@/features/lessons/lesson-actions"
import { LessonStatusBadge, MeetingLine } from "@/features/lessons/lesson-bits"
import { LessonPanel } from "@/features/lessons/visibility"
import { stageBase } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getFormat } from "@/i18n/server"
import { getLessonDetail } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("lessons")
  return { title: t("lesson") }
}

const lines = (text: string | null) =>
  (text ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default async function LessonPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/lessons/[lessonId]">) {
  const { serviceId, stageId, lessonId } = await params
  const d = await getLessonDetail(await getStaffContext(), serviceId, stageId, lessonId)
  if (!d) notFound()
  const [t, f] = await Promise.all([getTranslations("lessons"), getFormat()])
  const stage = stageBase(d)
  const base = `${stage}/lessons`
  const l = d.lesson
  const points = lines(l.teachingPoints)
  const activities = lines(l.activities)
  const published = d.homework.filter((h) => h.status === "published")
  const everPublished = d.homework.filter((h) => h.publishedAt !== null).length
  const visibleHomework = d.homework.filter((h) => h.status !== "archived")
  const archivedHomework = d.homework.filter((h) => h.status === "archived")

  return (
    <>
      <StageCrumbsTopbar h={d} tab="lessons" extra={[{ label: l.title }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <LessonStatusBadge status={l.status} archived={l.archived} />
              <MeetingLine meeting={l.meeting} today={d.today} />
            </>
          }
          title={l.title}
          description={
            l.summary ? (
              <span dir="auto" className="block">
                {l.summary}
              </span>
            ) : null
          }
          actions={
            d.can.manage ? (
              <LessonActions
                lesson={{
                  id: l.id,
                  title: l.title,
                  status: l.status,
                  archived: l.archived,
                  teachingDate: l.teachingDate,
                }}
                today={d.today}
                base={base}
                publishedHomework={everPublished}
              />
            ) : null
          }
        >
          {l.status === "ready" && l.teachingDate > d.today && d.can.manage ? (
            <p className="text-xs text-muted-foreground">
              {t("detail.readyHint", { date: f.longDate(l.teachingDate) })}
            </p>
          ) : null}
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex min-w-0 flex-col gap-8">
            <LessonPanel title={t("fields.teachingPlan")} who="servants">
              <Part title={t("fields.objectives")}>
                {l.objectives ? (
                  <p dir="auto" className="text-sm whitespace-pre-line">
                    {l.objectives}
                  </p>
                ) : (
                  <Empty>{t("detail.noObjectives")}</Empty>
                )}
              </Part>
              <Part title={t("fields.teachingPoints")}>
                {points.length ? (
                  <ol
                    dir="auto"
                    className="flex list-decimal flex-col gap-1.5 ps-5 text-sm marker:text-muted-foreground"
                  >
                    {points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                ) : (
                  <Empty>{t("detail.noTeachingPoints")}</Empty>
                )}
              </Part>
              <Part title={t("fields.activities")}>
                {activities.length ? (
                  <ul
                    dir="auto"
                    className="flex list-disc flex-col gap-1.5 ps-5 text-sm marker:text-muted-foreground"
                  >
                    {activities.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <Empty>{t("detail.noActivities")}</Empty>
                )}
              </Part>
              <Part title={t("fields.materials")}>
                {l.materials.length ? (
                  <ul dir="auto" className="flex flex-col gap-1.5 text-sm">
                    {l.materials.map((m, i) => (
                      <li key={i}>
                        {m.url ? (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground/80"
                          >
                            {m.label}
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          m.label
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>{t("detail.noMaterials")}</Empty>
                )}
              </Part>
              {l.notes ? (
                <Part title={t("fields.notes")}>
                  <p dir="auto" className="border-s-2 ps-3 text-sm whitespace-pre-line">
                    {l.notes}
                  </p>
                </Part>
              ) : null}
            </LessonPanel>

            <Section
              id="lesson-homework"
              title={t("detail.homework")}
              description={t("detail.homeworkDescription", { stage: d.stage.name })}
              actions={
                d.can.homework && !l.archived ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`${stage}/homework/new?lesson=${l.id}`}>
                      <Plus data-icon="inline-start" />
                      {t("detail.addHomework")}
                    </Link>
                  </Button>
                ) : null
              }
            >
              {visibleHomework.length === 0 ? (
                <p className="border border-dashed p-4 text-sm text-muted-foreground">
                  {t("detail.noHomework")}
                </p>
              ) : (
                <ul className="divide-y border-y">
                  {visibleHomework.map((hw) => (
                    <li key={hw.id}>
                      <HomeworkListItem
                        hw={hw}
                        today={d.today}
                        href={
                          hw.status === "draft"
                            ? `${stage}/homework/${hw.id}/edit`
                            : `${stage}/homework/${hw.id}`
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              {archivedHomework.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t.rich("detail.archivedHomework", {
                    count: archivedHomework.length,
                    link: (chunks) => (
                      <Link href={`${stage}/homework`} className="underline underline-offset-4">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              ) : null}
            </Section>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <LessonPanel title={t("detail.sharedWithParents")} who="parents">
              <p className="text-xs text-muted-foreground">
                {t("detail.sharedHint", { count: published.length })}
              </p>
              <Part title={t("fields.passage")}>
                {l.passage ? (
                  <p dir="auto" className="text-sm font-medium">
                    {l.passage}
                  </p>
                ) : (
                  <Empty>{t("detail.noPassage")}</Empty>
                )}
              </Part>
              <Part title={t("fields.memoryVerse")}>
                {l.memoryVerse ? (
                  <blockquote
                    dir="auto"
                    className="border-s-2 border-success ps-3 font-heading text-[15px] leading-relaxed text-pretty"
                  >
                    {l.memoryVerse}
                  </blockquote>
                ) : (
                  <Empty>{t("detail.noMemoryVerse")}</Empty>
                )}
              </Part>
            </LessonPanel>

            <section className="flex flex-col gap-4 border p-5" aria-labelledby="lesson-people">
              <h2
                id="lesson-people"
                className="font-heading text-base font-semibold tracking-tight"
              >
                {t("fields.servants")}
              </h2>
              <ul className="flex flex-col gap-3">
                {[
                  { ...l.responsible, role: t("fields.responsible") },
                  ...l.collaborators.map((c) => ({ ...c, role: t("detail.helping") })),
                ].map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <MemberAvatar name={p.name} initials={p.initials} seed={p.id} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.role}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border p-5 text-sm">
              <dt className="text-muted-foreground">{t("fields.teachingDate")}</dt>
              <dd>{f.longDate(l.teachingDate)}</dd>
              {l.meeting.kind === "session" ? (
                <>
                  <dt className="text-muted-foreground">{t("detail.session")}</dt>
                  <dd>
                    <Link
                      href={`/meetings/sessions/${l.meeting.id}`}
                      className="underline underline-offset-4"
                    >
                      {t("detail.openSession")}
                    </Link>
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{t("detail.created")}</dt>
              <dd>{f.instantLabel(l.createdAt, d.today)}</dd>
              <dt className="text-muted-foreground">{t("detail.lastChange")}</dt>
              <dd>{f.instantLabel(l.updatedAt, d.today)}</dd>
              {l.completedAt ? (
                <>
                  <dt className="text-muted-foreground">{t("detail.markedTaught")}</dt>
                  <dd>{f.instantLabel(l.completedAt, d.today)}</dd>
                </>
              ) : null}
            </dl>
          </aside>
        </div>
      </PageBody>
    </>
  )
}
