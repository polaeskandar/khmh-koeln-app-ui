import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { NoAccess } from "@/components/no-access"
import { PageHeader, Section } from "@/components/page-header"
import { RequestActions } from "@/features/privacy/request-actions"
import {
  DueLabel,
  KindLabel,
  RequestStatusBadge,
  SubjectName,
} from "@/features/privacy/request-bits"
import { getFormat } from "@/i18n/server"
import { isolate } from "@/lib/bidi"
import type { ErasedKind, KeptKind } from "@/server/mock/commands/privacy"
import { getDataRequest } from "@/server/queries/privacy"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("privacy.list")
  return { title: t("title") }
}

const ERASED: ErasedKind[] = [
  "person",
  "memberships",
  "attendance",
  "completions",
  "guardianLinks",
  "account",
  "roles",
  "notes",
]
const KEPT: KeptKind[] = [
  "sessionTotals",
  "recordedMarks",
  "reportedCompletions",
  "lessons",
  "homework",
  "sessionHistory",
]

/** One data protection request: who it is about, what the app stores, and what was done. */
export default async function DataRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const ctx = await getStaffContext()
  const [d, t, tl, tn, f] = await Promise.all([
    getDataRequest(ctx, requestId),
    getTranslations("privacy"),
    getTranslations("privacy.list"),
    getTranslations("nav"),
    getFormat(),
  ])
  const crumbs = [
    { label: tn("settings"), href: "/settings" },
    { label: tl("title"), href: "/settings/data-requests" },
  ]
  if (d === null) {
    return (
      <>
        <Topbar crumbs={crumbs} />
        <PageBody>
          <NoAccess title={tl("adminsOnly")} back={{ href: "/settings", label: tn("settings") }}>
            {tl("adminsOnlyHint")}
          </NoAccess>
        </PageBody>
      </>
    )
  }
  if (!d) notFound()
  const r = d.request
  const subject = r.subjectName ?? null
  const erases = ERASED.flatMap((k) =>
    d.inventory?.erase[k] ? [t(`erase.${k}`, { count: d.inventory.erase[k] })] : []
  )
  const keeps = KEPT.flatMap((k) =>
    d.inventory?.keep[k] ? [t(`keep.${k}`, { count: d.inventory.keep[k] })] : []
  )
  const done = r.outcome
    ? ERASED.flatMap((k) => (r.outcome?.[k] ? [t(`erase.${k}`, { count: r.outcome[k] })] : []))
    : []

  return (
    <>
      <Topbar crumbs={[...crumbs, { label: subject ?? tl("erasedCrumb") }]} />
      <PageBody>
        <PageHeader
          meta={
            <>
              <RequestStatusBadge status={r.status} />
              <span className="text-muted-foreground">
                <KindLabel kind={r.kind} />
              </span>
            </>
          }
          title={<SubjectName request={r} />}
          description={t("detail.requestedBy", { name: isolate(r.requestedBy) })}
          actions={
            r.status === "open" && (d.member || d.account) ? (
              <RequestActions
                requestId={r.id}
                kind={r.kind}
                subject={subject ?? ""}
                erases={erases}
                mentions={d.inventory?.mentions.length ?? 0}
                canErase={!d.isOwnAccount}
              />
            ) : null
          }
        />
        {d.isOwnAccount && r.status === "open" ? (
          <p className="border border-dashed p-4 text-sm text-muted-foreground">
            {t("detail.ownAccount")}
          </p>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-10">
            <Section id="request" title={t("detail.request")}>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border p-5 text-sm">
                <dt className="text-muted-foreground">{t("detail.received")}</dt>
                <dd>{f.atLabel(r.receivedAt, d.today)}</dd>
                <dt className="text-muted-foreground">{t("detail.channel")}</dt>
                <dd>{t(`channel.${r.channel}`)}</dd>
                {r.status === "open" ? (
                  <>
                    <dt className="text-muted-foreground">{t("detail.due")}</dt>
                    <dd>
                      <DueLabel request={r} />
                    </dd>
                  </>
                ) : null}
                {r.note ? (
                  <>
                    <dt className="text-muted-foreground">{t("detail.note")}</dt>
                    <dd dir="auto" className="whitespace-pre-line">
                      {r.note}
                    </dd>
                  </>
                ) : null}
              </dl>
            </Section>

            {d.member || d.account ? (
              <Section id="who" title={t("detail.who")}>
                <div className="flex flex-col divide-y border">
                  {d.member ? (
                    <div className="flex flex-col gap-2 p-5 text-sm">
                      <p className="font-medium">
                        {t("detail.memberRecord", { name: d.member.name })}
                      </p>
                      {d.member.memberships.length === 0 ? (
                        <p className="text-muted-foreground">{t("detail.noMemberships")}</p>
                      ) : (
                        <ul className="flex flex-col gap-1 text-muted-foreground">
                          {d.member.memberships.map((m, i) => (
                            <li key={i}>
                              {m.until
                                ? t("detail.membershipEnded", {
                                    group: m.group,
                                    from: f.mediumDate(m.from),
                                    until: f.mediumDate(m.until),
                                  })
                                : t("detail.membershipCurrent", {
                                    group: m.group,
                                    from: f.mediumDate(m.from),
                                  })}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  {d.account ? (
                    <div className="flex flex-col gap-1 p-5 text-sm">
                      <p className="font-medium">
                        {t("detail.accountRecord", { name: d.account.name })}
                      </p>
                      <p className="text-muted-foreground">
                        <bdi dir="ltr">{d.account.email}</bdi> · {d.account.roleSummary}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-10">
            {d.inventory && r.kind === "erasure" ? (
              <>
                <Section
                  id="erases"
                  title={t("detail.erases")}
                  description={t("detail.erasesDescription")}
                >
                  <ul className="flex list-disc flex-col gap-1 border p-5 ps-10 text-sm">
                    {erases.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </Section>
                {keeps.length > 0 ? (
                  <Section
                    id="keeps"
                    title={t("detail.keeps")}
                    description={t("detail.keepsDescription")}
                  >
                    <ul className="flex list-disc flex-col gap-1 border p-5 ps-10 text-sm text-muted-foreground">
                      {keeps.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </Section>
                ) : null}
                <Section
                  id="mentions"
                  title={t("detail.mentions", { count: d.inventory.mentions.length })}
                  description={t("detail.mentionsDescription")}
                >
                  {d.inventory.mentions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("detail.noMentions")}</p>
                  ) : (
                    <ul className="flex flex-col divide-y border">
                      {d.inventory.mentions.map((m) => (
                        <li key={m.id} className="flex flex-col gap-1 p-4 text-sm">
                          <span className="text-xs text-muted-foreground">
                            {t("detail.mentionWhere", {
                              where: t(`mention.${m.where}`),
                              group: m.group,
                              date: f.dayMonth(m.date),
                            })}
                          </span>
                          <q dir="auto" className="whitespace-pre-line">
                            {m.text}
                          </q>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </>
            ) : null}

            {d.inventory && r.kind === "copy" ? (
              <Section id="copy" title={t("detail.copy")} description={t("detail.copyDescription")}>
                <ul className="flex list-disc flex-col gap-1 border p-5 ps-10 text-sm">
                  {erases.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {r.status !== "open" ? (
              <Section id="outcome" title={t("detail.outcome")}>
                <div className="flex flex-col gap-3 border p-5 text-sm">
                  <p className="font-medium">
                    {r.status === "declined"
                      ? t("detail.declinedOn", {
                          when: r.closedAt ? f.atLabel(r.closedAt, d.today) : "",
                        })
                      : r.kind === "copy"
                        ? t("detail.sentOn", {
                            when: r.closedAt ? f.atLabel(r.closedAt, d.today) : "",
                          })
                        : t("detail.erasedOn", {
                            when: r.closedAt ? f.atLabel(r.closedAt, d.today) : "",
                          })}
                    {r.closedBy ? <> {t("detail.by", { name: r.closedBy })}</> : null}
                  </p>
                  {r.declineReason ? (
                    <p dir="auto" className="whitespace-pre-line text-muted-foreground">
                      {r.declineReason}
                    </p>
                  ) : null}
                  {done.length > 0 ? (
                    <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">
                      {done.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {r.status === "done" && r.kind === "erasure" ? (
                    <p className="text-muted-foreground">{t("detail.erasedNote")}</p>
                  ) : null}
                </div>
              </Section>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  )
}
