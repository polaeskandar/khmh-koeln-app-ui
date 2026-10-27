import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { PageBody } from "@/components/app-shell/topbar"
import { Section } from "@/components/page-header"
import { sessionHref } from "@/components/session-bits"
import { StageHeader } from "@/features/stages/stage-header"
import { StageCrumbsTopbar } from "@/features/stages/stage-page"
import { getFormat } from "@/i18n/server"
import { getStageAttendance, getStageHeader } from "@/server/queries/stage"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("attendance.stage")
  return { title: t("metaTitle") }
}

export default async function StageAttendancePage({
  params,
}: PageProps<"/services/[serviceId]/stages/[stageId]/attendance">) {
  const { serviceId, stageId } = await params
  const ctx = await getStaffContext()
  const h = await getStageHeader(ctx, serviceId, stageId)
  if (!h) notFound()
  const d = await getStageAttendance(ctx, serviceId, stageId)
  const [t, f] = await Promise.all([getTranslations("attendance.stage"), getFormat()])
  return (
    <>
      <StageCrumbsTopbar h={h} tab="attendance" />
      <PageBody>
        <StageHeader h={h} active="attendance" />
        <Section id="history" title={t("title")} description={t("description")}>
          {d.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b">
                    <th
                      scope="col"
                      className="h-12 px-3 text-start text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      {t("member")}
                    </th>
                    {d.sessions.map((s) => (
                      <th key={s.id} scope="col" className="w-16 px-1 text-center">
                        <Link
                          href={sessionHref(s)}
                          className="flex flex-col items-center leading-tight hover:underline"
                        >
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            {f.weekdayShort(s.date)}
                          </span>
                          <span className="text-xs tabular-nums">{f.shortDate(s.date)}</span>
                        </Link>
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="w-24 px-3 text-end text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      {t("present")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.person.id} className="border-b last:border-b-0 hover:bg-muted/40">
                      <th scope="row" className="px-3 py-2 text-start font-medium">
                        {r.person.name}
                      </th>
                      {r.cells.map((cell, i) => (
                        <td key={i} className="px-1 py-2 text-center">
                          <span
                            title={
                              cell === "present"
                                ? t("cell.present")
                                : cell === "not-marked"
                                  ? t("cell.notMarked")
                                  : t("cell.notInStage")
                            }
                            className={cn(
                              "inline-block size-3.5 align-middle",
                              cell === "present" && "bg-primary",
                              cell === "not-marked" &&
                                "bg-muted ring-1 ring-foreground/15 ring-inset",
                              cell === "not-on-roster" && "h-px w-3.5 bg-foreground/20"
                            )}
                          />
                          <span className="sr-only">
                            {cell === "present"
                              ? t("cellSr.present")
                              : cell === "not-marked"
                                ? t("cellSr.notMarked")
                                : t("cellSr.notInStage")}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-end tabular-nums">
                        {t("presentOf", { present: r.presentCount, total: d.sessions.length })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t">
                    <th
                      scope="row"
                      className="px-3 py-2 text-start text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      {t("present")}
                    </th>
                    {d.sessions.map((s) => (
                      <td key={s.id} className="px-1 py-2 text-center text-xs tabular-nums">
                        {s.counts.present}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("footnote")}</p>
        </Section>
      </PageBody>
    </>
  )
}
