import { Info, Link2Off } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Section } from "@/components/page-header"
import { GroupCard, MeetingList, memberTaskHref } from "@/features/member/member-bits"
import { TaskList } from "@/features/parent/parent-bits"
import { getFormat } from "@/i18n/server"
import { localTimeOf } from "@/lib/domain/time"
import { nowMs } from "@/server/mock/clock"
import { getMemberHome } from "@/server/queries/member"
import { getMemberContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("member.nav")
  return { title: t("home") }
}

function partOfDay(ms: number): "morning" | "afternoon" | "evening" {
  const hour = Number(localTimeOf(ms).slice(0, 2))
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
}

/**
 * The member's overview: what to do, when the next meetings are, and the
 * groups they are in with their servants and the last lesson's verse.
 */
export default async function MemberHomePage() {
  const d = await getMemberHome(await getMemberContext())
  const [t, tp, f] = await Promise.all([
    getTranslations("member.home"),
    getTranslations("parent.home"),
    getFormat(),
  ])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {tp(`greeting.${partOfDay(nowMs())}`, { name: d.name })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {f.longDate(d.today)} · {f.copticDate(d.today)}
        </p>
      </header>

      {!d.member ? (
        <div className="flex flex-col gap-2 border border-dashed p-6">
          <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
            <Link2Off className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("notLinked.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("notLinked.description")}</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-8">
            {d.toDo.length > 0 || d.done.length > 0 ? (
              <TaskList
                title={t("toDo")}
                tasks={d.toDo}
                today={d.today}
                empty={t("emptyToDo")}
                href={memberTaskHref}
              />
            ) : null}
            <Section
              id="next-meetings"
              title={t("nextMeetings")}
              description={t("nextMeetingsHint")}
            >
              <MeetingList meetings={d.meetings} today={d.today} />
            </Section>
            {d.done.length > 0 ? (
              <TaskList
                title={t("doneRecently")}
                tasks={d.done}
                today={d.today}
                href={memberTaskHref}
              />
            ) : null}
          </div>
          <aside className="flex min-w-0 flex-col gap-4" aria-labelledby="your-groups">
            <h2 id="your-groups" className="font-heading text-base font-semibold tracking-tight">
              {t("yourGroups")}
            </h2>
            {d.groups.length === 0 ? (
              <p className="border border-dashed p-5 text-sm text-muted-foreground">
                {t("noGroups")}
              </p>
            ) : (
              d.groups.map((g) => <GroupCard key={g.id} group={g} today={d.today} />)
            )}
            <p className="flex items-start gap-2 bg-muted/50 p-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t("whatYouSee")}
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
