import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, BookOpen, NotebookPen } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody } from "@/components/app-shell/topbar"
import { Section } from "@/components/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { AgendaRow } from "@/components/session-bits"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { AddMemberDialog, MembershipMenu } from "@/features/members/member-dialogs"
import { LessonStatusBadge } from "@/features/lessons/lesson-bits"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { StageHeader } from "@/features/stages/stage-header"
import { getFormat } from "@/i18n/server"
import { today as clockToday } from "@/server/mock/clock"
import { getStageLessons, getStageHomework } from "@/server/queries/learning"
import { listMembers, personDirectory } from "@/server/queries/members"
import { getStageDetail } from "@/server/queries/services"
import { getStageHeader } from "@/server/queries/stage"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("stages")
  return { title: t("kind") }
}

export default async function StageOverviewPage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]">) {
  const { serviceId, stageId } = await params
  const ctx = await getStaffContext()
  const [h, d] = await Promise.all([
    getStageHeader(ctx, serviceId, stageId),
    getStageDetail(ctx, serviceId, stageId),
  ])
  if (!h || !d) notFound()
  const [t, tn, f] = await Promise.all([
    getTranslations("stages"),
    getTranslations("nav"),
    getFormat(),
  ])
  const today = clockToday()
  const lessons = await getStageLessons(ctx, serviceId, stageId)
  const homework = await getStageHomework(ctx, serviceId, stageId)
  const nextLesson = lessons?.upcoming[0]
  const openHomework =
    homework?.rows.filter((r) => r.status === "published" && (!r.dueDate || r.dueDate >= today)) ??
    []
  const directory = h.can.members ? personDirectory(ctx) : []
  const placementServices = h.can.members ? (await listMembers(ctx)).services : []
  return (
    <>
      <StageCrumbsTopbar h={h} tab="overview" />
      <PageBody>
        <StageHeader h={h} active="overview" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <Section
            id="members"
            title={t("overview.members", { count: d.members.length })}
            description={
              d.recentDates.length > 0
                ? t("overview.squares", { count: d.recentDates.length })
                : t("overview.squaresEmpty")
            }
            actions={
              h.can.members ? (
                <AddMemberDialog
                  serviceId={serviceId}
                  stageId={stageId}
                  stageName={h.stage.name}
                  people={directory}
                  services={placementServices}
                />
              ) : null
            }
          >
            {d.members.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>{t("overview.empty")}</EmptyTitle>
                  <EmptyDescription>{t("overview.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y border-y">
                {d.members.map((m) => (
                  <li key={m.membershipId} className="flex items-center gap-3 py-2.5">
                    <MemberAvatar
                      name={m.person.name}
                      initials={m.person.initials}
                      seed={m.person.id}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{m.person.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.person.displayName ? `${m.person.fullName} · ` : ""}
                        {t("overview.since", { date: f.mediumDate(m.since) })}
                      </span>
                    </span>
                    <span
                      className="hidden items-center gap-0.5 sm:flex"
                      role="img"
                      aria-label={t("overview.presentAt", {
                        present: m.recent.filter(Boolean).length,
                        total: m.recent.length,
                      })}
                    >
                      {m.recent.map((present, i) => (
                        <span
                          key={i}
                          title={
                            present
                              ? t("overview.dayPresent", { date: f.dayMonth(d.recentDates[i]) })
                              : t("overview.dayNotMarked", { date: f.dayMonth(d.recentDates[i]) })
                          }
                          className={
                            present
                              ? "size-2.5 bg-primary"
                              : "size-2.5 bg-muted ring-1 ring-foreground/10 ring-inset"
                          }
                        />
                      ))}
                    </span>
                    {h.can.members ? (
                      <MembershipMenu
                        membershipId={m.membershipId}
                        personName={m.person.name}
                        where={h.stage.name}
                        otherStages={d.otherStages}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="flex min-w-0 flex-col gap-10">
            <Section
              id="next"
              title={t("overview.comingUp")}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/services/${serviceId}/stages/${stageId}/meetings`}>
                    {tn("meetings")} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              {d.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("overview.nothingPlanned")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {d.upcoming.slice(0, 3).map((item) => (
                    <li key={item.kind === "session" ? item.id : item.key}>
                      <AgendaRow
                        compact
                        item={item}
                        today={today}
                        href={
                          item.kind === "session"
                            ? `/meetings/sessions/${item.id}`
                            : `/meetings/schedules/${item.scheduleId}`
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              id="lesson"
              title={t("overview.nextLesson")}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/services/${serviceId}/stages/${stageId}/lessons`}>
                    {t("tabs.lessons")} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              {nextLesson ? (
                <Link
                  href={`/services/${serviceId}/stages/${stageId}/lessons/${nextLesson.id}`}
                  className="flex items-start gap-3 border p-4 hover:bg-muted/60"
                >
                  <BookOpen
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{nextLesson.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.relativeDay(nextLesson.teachingDate, today)} ·{" "}
                      {nextLesson.responsible.name}
                    </span>
                  </span>
                  <LessonStatusBadge status={nextLesson.status} />
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">{t("overview.noLesson")}</p>
              )}
            </Section>

            <Section
              id="homework"
              title={t("overview.openHomework")}
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/services/${serviceId}/stages/${stageId}/homework`}>
                    {t("tabs.homework")} <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              }
            >
              {openHomework.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("overview.noHomework")}</p>
              ) : (
                <ul className="divide-y border-y">
                  {openHomework.map((hw) => (
                    <li key={hw.id}>
                      <Link
                        href={`/services/${serviceId}/stages/${stageId}/homework/${hw.id}`}
                        className="-mx-2 flex items-center gap-3 px-2 py-2.5 hover:bg-muted/60"
                      >
                        <NotebookPen
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{hw.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {hw.dueDate
                              ? t("overview.due", { date: f.relativeDayInline(hw.dueDate, today) })
                              : t("overview.noDueDate")}{" "}
                            · {hw.lesson.title}
                          </span>
                        </span>
                        {hw.counts ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("overview.completedOf", {
                              completed: hw.counts.completed,
                              assigned: hw.counts.assigned,
                            })}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  )
}
