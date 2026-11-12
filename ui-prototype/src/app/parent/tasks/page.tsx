import { getTranslations } from "next-intl/server"

import { Section } from "@/components/page-header"
import { ChildSwitcher } from "@/components/portal/portal-bits"
import { TaskList } from "@/components/portal/portal-home"
import { getParentHome } from "@/server/queries/portals"
import { getParentContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("portal.nav"))("tasks") }
}

export default async function ParentTasksPage({ searchParams }: PageProps<"/parent/tasks">) {
  const query = await searchParams
  const data = getParentHome(
    await getParentContext(),
    typeof query.child === "string" ? query.child : null
  )
  const t = await getTranslations("portal")
  const q = data.child ? `?child=${data.child.id}` : ""

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("tasksTitle")}</h1>
      <ChildSwitcher
        kids={data.children}
        selected={data.child?.id ?? null}
        hrefFor={(id) => `/parent/tasks?child=${id}`}
      />
      {data.child ? (
        <>
          <Section title={t("toDo", { name: data.child.firstName })}>
            <TaskList
              tasks={data.open}
              hrefFor={(id) => `/parent/tasks/${id}${q}`}
              empty={t("allDone")}
            />
          </Section>
          <Section title={t("doneRecently")}>
            <TaskList
              tasks={data.done}
              hrefFor={(id) => `/parent/tasks/${id}${q}`}
              empty={t("nothingDone")}
            />
          </Section>
        </>
      ) : null}
    </>
  )
}
