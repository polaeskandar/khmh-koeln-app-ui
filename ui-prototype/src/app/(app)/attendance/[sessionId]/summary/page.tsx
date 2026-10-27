import Link from "next/link"
import { notFound } from "next/navigation"
import { Info } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { HistoryTimeline } from "@/components/history-timeline"
import { MemberAvatar } from "@/components/member-avatar"
import { PageHeader, Section } from "@/components/page-header"
import { RosterCells } from "@/components/roster-cells"
import { SessionBadges, SessionWhen } from "@/components/session-bits"
import { ServiceTag } from "@/components/service-tag"
import { Button } from "@/components/ui/button"
import { ReopenButton } from "@/features/attendance/reopen-button"
import { getFormat, getSessionLines } from "@/i18n/server"
import type { PersonRef } from "@/lib/view-models"
import { getAttendanceSummary } from "@/server/queries/attendance"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("attendance.summary")
  return { title: t("metaTitle") }
}

function People({
  people,
  note,
}: {
  people: { person: PersonRef; time?: string }[]
  note?: string
}) {
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
      {people.map(({ person, time }) => (
        <li key={person.id} className="flex items-center gap-3 border-b py-2">
          <MemberAvatar
            name={person.name}
            initials={person.initials}
            seed={person.id}
            className="size-7 text-[11px]"
          />
          <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
          {time ? <span className="text-xs text-muted-foreground tabular-nums">{time}</span> : null}
          {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export default async function AttendanceSummaryPage({
  params,
}: PageProps<"/attendance/[sessionId]/summary">) {
  const { sessionId } = await params
  const d = await getAttendanceSummary(await getStaffContext(), sessionId)
  if (!d) notFound()
  const [t, ta, tn, f, lines] = await Promise.all([
    getTranslations("attendance.summary"),
    getTranslations("attendance"),
    getTranslations("nav"),
    getFormat(),
    getSessionLines(),
  ])
  const s = d.session
  const c = s.counts
  const expected = s.rosterMode === "expected" && c.rosterSize !== null

  return (
    <>
      <Topbar
        crumbs={[
          { label: tn("attendance"), href: "/attendance" },
          // The long date without its year: "Sunday 8 November".
          {
            label: t("crumb", { group: s.group, date: f.longDate(s.date).replace(/ \d{4}$/, "") }),
          },
        ]}
      />
      <PageBody>
        <PageHeader
          meta={
            <>
              <ServiceTag service={s.service} />
              <SessionBadges item={s} />
            </>
          }
          title={s.group}
          description={`${s.title} · ${f.longDate(s.date)}`}
          actions={
            <>
              {s.status === "completed" && s.can.reopen ? (
                <ReopenButton sessionId={s.id} group={s.group} />
              ) : null}
              {s.status === "active" ? (
                <Button asChild>
                  <Link href={`/attendance/${s.id}`}>{t("continue")}</Link>
                </Button>
              ) : null}
              <Button variant="ghost" asChild>
                <Link href={`/meetings/sessions/${s.id}`}>{ta("sessionDetails")}</Link>
              </Button>
            </>
          }
        >
          <SessionWhen item={s} today={d.today} className="mt-1" />
        </PageHeader>

        <div className="flex flex-col gap-4 border p-5 md:flex-row md:items-center md:gap-8">
          <div className="flex shrink-0 flex-col">
            <span className="font-heading text-4xl font-semibold tabular-nums">
              {expected ? c.rosterPresent : c.present}
            </span>
            <span className="text-sm text-muted-foreground">
              {expected ? t("ofRoster", { total: c.rosterSize ?? 0 }) : t("present")}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {expected && c.rosterSize ? (
              <RosterCells
                filled={c.rosterPresent}
                total={c.rosterSize}
                extra={c.notOnRoster}
                size="lg"
              />
            ) : null}
            <span className="text-sm text-muted-foreground">
              {lines.present(s)}
              {s.closedAt
                ? ` · ${
                    s.closedBy
                      ? t("closedAtBy", {
                          when: f.atLabel(s.closedAt, d.today),
                          name: s.closedBy.name,
                        })
                      : t("closedAt", { when: f.atLabel(s.closedAt, d.today) })
                  }`
                : ""}
            </span>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-10">
            <Section id="present" title={t("presentTitle", { count: d.present.length })}>
              {d.present.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("nobodyPresent")}</p>
              ) : (
                <People
                  people={d.present.map((e) => ({
                    person: e.person,
                    time: f.instantTime(e.recordedAt),
                  }))}
                />
              )}
              {d.erasedPresent > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("erasedPresent", { count: d.erasedPresent })}
                </p>
              ) : null}
            </Section>

            {d.notOnRoster.length > 0 ? (
              <Section
                id="extra"
                title={t("extraTitle", { count: d.notOnRoster.length })}
                description={t("extraDescription")}
              >
                <People
                  people={d.notOnRoster.map((e) => ({
                    person: e.person,
                    time: f.instantTime(e.recordedAt),
                  }))}
                />
              </Section>
            ) : null}

            {expected ? (
              <Section id="not-marked" title={t("notMarkedTitle", { count: d.notMarked.length })}>
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t("notMarkedNote")}
                </p>
                {d.notMarked.length === 0 ? (
                  <p className="text-sm">{t("everyoneMarked")}</p>
                ) : (
                  <People people={d.notMarked} />
                )}
              </Section>
            ) : null}

            {d.corrections.length > 0 ? (
              <Section id="corrections" title={t("corrections")}>
                <ul className="flex flex-col gap-2 text-sm">
                  {d.corrections.map((e) => {
                    const values = {
                      name: e.person.name,
                      time: f.instantTime(e.recordedAt),
                      when: e.removedAt ? f.atLabel(e.removedAt, d.today) : "",
                      person: (chunks: React.ReactNode) => (
                        <span className="text-foreground">{chunks}</span>
                      ),
                    }
                    const by = e.removedBy?.name
                    const reason = e.removalReason
                    return (
                      <li key={e.id} className="text-muted-foreground">
                        {by && reason
                          ? t.rich("correctionByReason", { ...values, by, reason })
                          : by
                            ? t.rich("correctionBy", { ...values, by })
                            : reason
                              ? t.rich("correctionReason", { ...values, reason })
                              : t.rich("correction", values)}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            ) : null}
          </div>
          <Section id="history" title={t("history")}>
            <HistoryTimeline entries={d.history} today={d.today} />
          </Section>
        </div>
      </PageBody>
    </>
  )
}
