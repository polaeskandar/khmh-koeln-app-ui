import Link from "next/link"
import { Hourglass, Info } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { ChildSwitcher, TaskList } from "@/features/parent/parent-bits"
import { getFormat } from "@/i18n/server"
import { localTimeOf } from "@/lib/domain/time"
import { nowMs } from "@/server/mock/clock"
import { getParentHome } from "@/server/queries/parent"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("parent.nav")
  return { title: t("home") }
}

function partOfDay(ms: number): "morning" | "afternoon" | "evening" {
  const hour = Number(localTimeOf(ms).slice(0, 2))
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
}

export default async function ParentHomePage({ searchParams }: PageProps<"/parent">) {
  const { child } = await searchParams
  const d = await getParentHome(
    await getParentContext(),
    typeof child === "string" ? child : undefined
  )
  const [t, f] = await Promise.all([getTranslations("parent.home"), getFormat()])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {t(`greeting.${partOfDay(nowMs())}`, { name: d.parentName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {f.longDate(d.today)} · {f.copticDate(d.today)}
        </p>
      </header>

      {d.pendingAccess ? (
        <p className="flex items-start gap-2 border border-dashed p-4 text-sm">
          <Hourglass className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            {t.rich("pendingAccess", {
              link: (chunks) => (
                <Link href="/parent/children" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </p>
      ) : null}

      {!d.selected ? (
        <div className="flex flex-col gap-2 border border-dashed p-6">
          <h2 className="font-heading text-lg font-semibold">{t("noChild.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("noChild.description")}</p>
        </div>
      ) : (
        <>
          <ChildSwitcher items={d.children} selectedId={d.selected.id} href="/parent" />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div className="flex min-w-0 flex-col gap-8">
              <TaskList
                title={t("toDoFor", { name: d.selected.name })}
                tasks={d.toDo}
                today={d.today}
                empty={t("emptyToDo")}
              />
              {d.done.length > 0 ? (
                <TaskList title={t("doneRecently")} tasks={d.done} today={d.today} />
              ) : null}
            </div>
            <aside className="flex flex-col gap-3 self-start bg-muted/50 p-5 text-sm">
              <h2 className="inline-flex items-center gap-2 font-heading text-base font-semibold">
                <Info className="size-4 text-muted-foreground" aria-hidden="true" />
                {t("howItWorks.title")}
              </h2>
              <p className="text-muted-foreground">
                {d.selected.stage
                  ? t("howItWorks.afterLesson", { stage: d.selected.stage })
                  : t("howItWorks.afterLessonNoStage")}
              </p>
              <p className="text-muted-foreground">{t("howItWorks.tickOff")}</p>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
