import Link from "next/link"
import { BookOpenText, CalendarClock, Check, ExternalLink } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { MemberAvatar } from "@/components/member-avatar"
import { PageHeader, Section } from "@/components/page-header"
import { PresentBar } from "@/components/session-card"
import { ServiceSwatch } from "@/components/service-tag"
import { TaskStatusBadge } from "@/components/status"
import { TaskActions } from "@/features/tasks/task-actions"
import { getFormat } from "@/i18n/server"
import { today } from "@/server/mock/clock"
import { getTask } from "@/server/queries/learning"
import { getStaffContext } from "@/server/request"

export default async function TaskPage({ params }: PageProps<"/lessons/tasks/[taskId]">) {
  const { taskId } = await params
  const data = getTask(await getStaffContext(), taskId)
  const { task } = data
  const t = await getTranslations("tasks")
  const f = await getFormat()
  const now = today()

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/lessons/tasks" }, { label: task.title }]} />
      <PageBody>
        <PageHeader
          title={task.title}
          meta={
            <>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <ServiceSwatch tone={data.unit.tone} />
                <bdi>{data.unit.name}</bdi>
              </span>
              <TaskStatusBadge status={task.status} />
            </>
          }
          actions={<TaskActions taskId={task.id} status={task.status} />}
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`/lessons/${data.lesson.id}`}
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <BookOpenText className="size-4" aria-hidden="true" />
              {data.lesson.title}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden="true" />
              {task.dueDate ? t("due", { date: f.mediumDate(task.dueDate) }) : t("noDue")}
            </span>
          </p>
        </PageHeader>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Section title={t("whatTheyRead")} description={t("whatTheyReadHint")}>
            <div className="flex flex-col gap-4 border bg-card p-5">
              <p className="whitespace-pre-line">{task.instructions}</p>
              {task.resources.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {task.resources.map((r) => (
                    <li key={r.label} className="inline-flex items-center gap-2 text-sm">
                      <ExternalLink className="size-4 text-primary" aria-hidden="true" />
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
            </div>
          </Section>
          <Section
            title={t("progress")}
            description={
              task.status === "published"
                ? t("doneOf", { done: data.done, total: data.total })
                : t("notPublishedYet")
            }
          >
            <PresentBar present={data.done} roster={data.total} />
            <ul className="divide-y border">
              {data.people.map((p) => (
                <li key={p.person.id} className="flex items-center gap-3 px-3 py-2.5">
                  <MemberAvatar
                    name={p.person.name}
                    initials={p.person.initials}
                    seed={p.person.id}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{p.person.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.doneAt
                        ? p.byOwnAccount
                          ? t("reportedThemselves", { when: f.instantLabel(p.doneAt, now) })
                          : t("reportedBy", {
                              name: p.doneBy ?? "",
                              when: f.instantLabel(p.doneAt, now),
                            })
                        : p.via === "own"
                          ? t("ownAccount")
                          : t("viaParent")}
                    </span>
                  </span>
                  {p.doneAt ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider text-success uppercase">
                      <Check className="size-3.5" />
                      {t("done")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("notYet")}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </PageBody>
    </>
  )
}
