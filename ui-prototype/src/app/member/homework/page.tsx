import { getTranslations } from "next-intl/server"

import { memberTaskHref } from "@/features/member/member-bits"
import { TaskList } from "@/features/parent/parent-bits"
import { getMemberHomework } from "@/server/queries/member"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("member.nav")
  return { title: t("homework") }
}

/** Everything the servants of the member's stages published: still to do, and done. */
export default async function MemberHomeworkPage() {
  const d = await getMemberHomework(await getMemberContext())
  const [t, tn] = await Promise.all([
    getTranslations("member.homework"),
    getTranslations("member.nav"),
  ])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {tn("homework")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {d.member ? t("description") : t("notLinked")}
        </p>
      </header>
      {d.member ? (
        <div className="flex max-w-3xl flex-col gap-10">
          <TaskList
            title={t("toDo")}
            tasks={d.toDo}
            today={d.today}
            empty={t("emptyToDo")}
            href={memberTaskHref}
          />
          <TaskList
            title={t("done")}
            tasks={d.done}
            today={d.today}
            empty={t("emptyDone")}
            href={memberTaskHref}
          />
        </div>
      ) : null}
    </div>
  )
}
