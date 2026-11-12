import { getTranslations } from "next-intl/server"

import { Section } from "@/components/page-header"
import { TaskList } from "@/components/portal/portal-home"
import { getMemberHome } from "@/server/queries/portals"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("portal.nav"))("tasks") }
}

export default async function MemberTasksPage() {
  const data = getMemberHome(await getMemberContext())
  const t = await getTranslations("portal")

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("tasksTitle")}</h1>
      <Section title={t("yourTasks")}>
        <TaskList
          tasks={data.open}
          hrefFor={(id) => `/member/tasks/${id}`}
          empty={t("allDoneSelf")}
        />
      </Section>
      <Section title={t("doneRecently")}>
        <TaskList
          tasks={data.done}
          hrefFor={(id) => `/member/tasks/${id}`}
          empty={t("nothingDone")}
        />
      </Section>
    </>
  )
}
