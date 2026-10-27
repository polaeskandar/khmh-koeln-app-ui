"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import type { DataRequestRow } from "@/server/queries/privacy"

import { DueLabel, KindLabel, RequestStatusBadge, useSubjectLabel } from "./request-bits"

/** Open requests by due date, or closed ones with their outcome. Each row opens the request. */
export function DataRequestRows({
  rows,
  today,
  variant,
}: {
  rows: DataRequestRow[]
  today: LocalDate
  variant: "open" | "closed"
}) {
  const t = useTranslations("privacy.list")
  const f = useFormat()
  const subject = useSubjectLabel()
  return (
    <div className="overflow-x-auto border">
      <Table className="min-w-[720px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-4">{t("subject")}</TableHead>
            <TableHead>{t("kind")}</TableHead>
            <TableHead>{t("received")}</TableHead>
            {variant === "open" ? (
              <TableHead>{t("due")}</TableHead>
            ) : (
              <>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("closedOn")}</TableHead>
              </>
            )}
            <TableHead className="pe-4">{t("requestedBy")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="relative">
              <TableCell className="ps-4">
                <Link
                  href={`/settings/data-requests/${r.id}`}
                  className="font-medium underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {subject(r)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <KindLabel kind={r.kind} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {f.dayMonth(f.instantDate(r.receivedAt))}
              </TableCell>
              {variant === "open" ? (
                <TableCell className="text-sm">
                  <DueLabel request={r} />
                </TableCell>
              ) : (
                <>
                  <TableCell>
                    <RequestStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.closedAt
                      ? r.closedBy
                        ? t("closedBy", {
                            when: f.instantLabel(r.closedAt, today),
                            name: r.closedBy,
                          })
                        : f.instantLabel(r.closedAt, today)
                      : null}
                  </TableCell>
                </>
              )}
              <TableCell className="pe-4 text-sm text-muted-foreground">{r.requestedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
