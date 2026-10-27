import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { CompletionControl } from "@/features/parent/completion-control"
import { ParentHomeworkView } from "@/features/parent/homework-view"
import { getParentHomeworkDetail } from "@/server/queries/parent"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("parent.nav")
  return { title: t("homework") }
}

export default async function ParentHomeworkDetailPage({
  params,
  searchParams,
}: PageProps<"/parent/homework/[homeworkId]">) {
  const { homeworkId } = await params
  const { child } = await searchParams
  const d = await getParentHomeworkDetail(
    await getParentContext(),
    homeworkId,
    typeof child === "string" ? child : undefined
  )
  if (!d) notFound()
  const [t, tn] = await Promise.all([
    getTranslations("parent.homework"),
    getTranslations("parent.nav"),
  ])
  const task = d.task
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href={`/parent/homework?child=${d.child.id}`}
        className="-ms-1 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {d.siblings > 0 ? t("backFor", { name: d.child.name }) : tn("homework")}
      </Link>
      <ParentHomeworkView
        child={{ name: d.child.name, stage: d.child.stage }}
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
            childId={d.child.id}
            childName={d.child.name}
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
