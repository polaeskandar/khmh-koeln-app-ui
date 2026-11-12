import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import { StatusBadge } from "@/components/status"
import { RequestActions } from "@/features/privacy/data-actions"
import { getFormat } from "@/i18n/server"
import { getDataRequest } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

type ImpactKey =
  | "person"
  | "account"
  | "memberships"
  | "attendance"
  | "completions"
  | "guardianships"
  | "assignments"

export default async function DataRequestPage({ params }: PageProps<"/admin/data/[requestId]">) {
  const { requestId } = await params
  const data = getDataRequest(await getStaffContext(), requestId)
  const { request } = data
  const t = await getTranslations("data")
  const f = await getFormat()
  const name = request.subjectName ?? t("erasedSubject", { what: request.erasedSubject ?? "" })
  const impact = data.impact
    ? Object.entries(data.impact)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => t(`impact.${k as ImpactKey}`, { count: n }))
    : []

  return (
    <>
      <Topbar crumbs={[{ label: t("title"), href: "/admin/data" }, { label: name }]} />
      <PageBody>
        <PageHeader
          title={name}
          meta={
            <>
              <StatusBadge tone="neutral">{t(`kinds.${request.kind}`)}</StatusBadge>
              <StatusBadge
                tone={
                  request.status === "open"
                    ? "info"
                    : request.status === "done"
                      ? "success"
                      : "muted"
                }
              >
                {t(`status.${request.status}`)}
              </StatusBadge>
            </>
          }
          description={t("received", {
            date: f.mediumDate(request.receivedAt.slice(0, 10)),
            due: f.mediumDate(request.dueOn),
          })}
        />
        <dl className="grid gap-px border bg-border sm:grid-cols-2">
          <div className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t("requestedBy")}</dt>
            <dd className="text-sm">{request.requestedBy}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t("channel")}</dt>
            <dd className="text-sm">{t(`record.channels.${request.channel}`)}</dd>
          </div>
          {request.note ? (
            <div className="bg-card p-4 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("note")}</dt>
              <dd className="text-sm">{request.note}</dd>
            </div>
          ) : null}
        </dl>
        {data.subject ? (
          <Section title={t("subject")}>
            <p className="text-sm">
              {data.subject.name}
              {data.subject.groups.length > 0 ? ` · ${data.subject.groups.join(", ")}` : ""}
              {data.subject.hasAccount ? ` · ${t("hasAccount")}` : ""}
            </p>
          </Section>
        ) : null}
        {request.status === "open" ? (
          <Section
            title={request.kind === "copy" ? t("copyTitle") : t("erasureTitle")}
            description={request.kind === "copy" ? t("copyHint") : t("erasureHint")}
          >
            {request.kind === "erasure" ? (
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                {impact.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <RequestActions
              requestId={request.id}
              kind={request.kind}
              name={name}
              impact={impact}
              self={data.self}
            />
          </Section>
        ) : (
          <Section title={t("outcome")}>
            <p className="text-sm text-muted-foreground">
              {request.status === "declined"
                ? t("declinedBecause", { reason: request.declineReason ?? "" })
                : t("closedBy", {
                    name: data.closedBy ?? t("formerAccount"),
                    date: f.mediumDate((request.closedAt ?? request.receivedAt).slice(0, 10)),
                  })}
            </p>
            {request.outcome ? (
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                {Object.entries(request.outcome)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <li key={k}>{t(`impact.${k as ImpactKey}`, { count: n })}</li>
                  ))}
              </ul>
            ) : null}
          </Section>
        )}
      </PageBody>
    </>
  )
}
