import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { CompletionControl } from "@/features/parent/completion-control"
import { ParentHomeworkView } from "@/features/parent/homework-view"
import { getMemberHomeworkDetail } from "@/server/queries/member"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("member.nav")
  return { title: t("homework") }
}

/** One task as the member reads it, with their own Mark as done. */
export default async function MemberHomeworkDetailPage({
  params,
}: PageProps<"/member/homework/[homeworkId]">) {
  const { homeworkId } = await params
  const d = await getMemberHomeworkDetail(await getMemberContext(), homeworkId)
  if (!d) notFound()
  const [t, tn] = await Promise.all([
    getTranslations("member.homework"),
    getTranslations("member.nav"),
  ])
  const task = d.task
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/member/homework"
        className="-ms-1 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {tn("homework")}
      </Link>
      <ParentHomeworkView
        child={{ name: d.member.name, stage: task.stage }}
        forText={t("forYou")}
        title={task.title}
        instructions={task.instructions}
        dueDate={task.dueDate}
        today={d.today}
        lesson={d.lesson}
        resources={d.resources}
        status={
          <CompletionControl
            key={`${task.done}-${task.completedAt}`}
            homeworkId={task.id}
            childId={d.member.id}
            childName={d.member.name}
            self
            today={d.today}
            initial={{
              done: task.done,
              completedAt: task.completedAt,
              completedByYou: task.completedByYou,
              completedBy: task.completedBy,
            }}
          />
        }
      />
    </div>
  )
}
