import { getTranslations } from "next-intl/server"

import { ChildSwitcher } from "@/components/portal/portal-bits"
import { LessonGrid, TaskList } from "@/components/portal/portal-home"
import { Section } from "@/components/page-header"
import { getParentHome } from "@/server/queries/portals"
import { viewerInfo } from "@/server/queries/present"
import { getParentContext } from "@/server/request"

export default async function ParentHomePage({ searchParams }: PageProps<"/parent">) {
  const query = await searchParams
  const ctx = await getParentContext()
  const data = getParentHome(ctx, typeof query.child === "string" ? query.child : null)
  const t = await getTranslations("portal")
  const viewer = viewerInfo(ctx.state, ctx.viewer)
  const child = data.child
  const q = child ? `?child=${child.id}` : ""

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("hello", { name: viewer.firstName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {child ? t("parentIntro", { name: child.firstName }) : t("noChildren")}
        </p>
      </div>
      <ChildSwitcher
        kids={data.children}
        selected={child?.id ?? null}
        hrefFor={(id) => `/parent?child=${id}`}
      />
      {child ? (
        <>
          <Section title={t("toDo", { name: child.firstName })}>
            <TaskList
              tasks={data.open}
              hrefFor={(id) => `/parent/tasks/${id}${q}`}
              empty={t("allDone")}
            />
          </Section>
          <Section title={t("recentLessons")}>
            <LessonGrid
              lessons={data.lessons.slice(0, 4)}
              hrefFor={(id) => `/parent/lessons/${id}${q}`}
            />
          </Section>
          {data.done.length > 0 ? (
            <Section title={t("doneRecently")}>
              <TaskList tasks={data.done} hrefFor={(id) => `/parent/tasks/${id}${q}`} empty="" />
            </Section>
          ) : null}
        </>
      ) : null}
    </>
  )
}
