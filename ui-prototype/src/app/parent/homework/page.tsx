import { getTranslations } from "next-intl/server"

import { ChildSwitcher, TaskList } from "@/features/parent/parent-bits"
import { getParentHomework } from "@/server/queries/parent"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("parent.nav")
  return { title: t("homework") }
}

export default async function ParentHomeworkPage({ searchParams }: PageProps<"/parent/homework">) {
  const { child } = await searchParams
  const d = await getParentHomework(
    await getParentContext(),
    typeof child === "string" ? child : undefined
  )
  const [t, tn] = await Promise.all([
    getTranslations("parent.homework"),
    getTranslations("parent.nav"),
  ])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {tn("homework")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {d.selected
            ? d.selected.stage
              ? t("description", { stage: d.selected.stage, name: d.selected.name })
              : t("descriptionNoStage", { name: d.selected.name })
            : t("noChild")}
        </p>
      </header>
      {d.selected ? (
        <>
          <ChildSwitcher items={d.children} selectedId={d.selected.id} href="/parent/homework" />
          <div className="flex max-w-3xl flex-col gap-10">
            <TaskList
              title={t("toDo")}
              tasks={d.toDo}
              today={d.today}
              empty={t("emptyToDo", { name: d.selected.name })}
            />
            <TaskList title={t("done")} tasks={d.done} today={d.today} empty={t("emptyDone")} />
          </div>
        </>
      ) : null}
    </div>
  )
}
