"use client"

/**
 * Homework of a stage (S04): three tabs by status, the lesson it belongs to,
 * the due date and how many parents reported it done. No ranking of children
 * or classes anywhere. Archived homework stays reachable in its own tab, where
 * the actions menu offers to restore it.
 */
import { useState } from "react"
import Link from "next/link"
import { NotebookPen } from "lucide-react"
import { useTranslations } from "next-intl"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import type { HomeworkRow } from "@/server/queries/learning"

import { CompletionMeter, HomeworkStatusBadge } from "../lessons/lesson-bits"
import { HomeworkActionsMenu, PublishHomeworkButton } from "./homework-actions"
import { useDueLabel } from "./homework-bits"

type Tab = "published" | "draft" | "archived"

export function HomeworkTable({
  rows,
  today,
  stageBase,
  canManage,
}: {
  rows: HomeworkRow[]
  today: LocalDate
  stageBase: string
  canManage: boolean
}) {
  const t = useTranslations("homework")
  const f = useFormat()
  const due = useDueLabel()
  const count = (status: Tab) => rows.filter((r) => r.status === status).length
  const [tab, setTab] = useState<Tab>(
    count("published") === 0 && count("draft") > 0 ? "draft" : "published"
  )
  const visible = rows.filter((r) => r.status === tab)

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="published">
            {t("table.published", { count: count("published") })}
          </TabsTrigger>
          <TabsTrigger value="draft">{t("table.drafts", { count: count("draft") })}</TabsTrigger>
          <TabsTrigger value="archived">
            {t("table.archived", { count: count("archived") })}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NotebookPen />
            </EmptyMedia>
            <EmptyTitle>{t(`table.empty.${tab}.title`)}</EmptyTitle>
            <EmptyDescription>{t(`table.empty.${tab}.text`)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto border">
          <Table className="min-w-[820px]">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">{t("table.homework")}</TableHead>
                <TableHead className="w-44">{t("table.due")}</TableHead>
                <TableHead className="w-32">{t("table.status")}</TableHead>
                <TableHead className="w-60">{t("table.reported")}</TableHead>
                <TableHead className="w-36 pe-4">
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((hw) => (
                <TableRow key={hw.id}>
                  <TableCell className="ps-4">
                    <div className="flex min-w-0 flex-col gap-0.5 py-1">
                      <Link
                        href={
                          hw.status === "draft"
                            ? `${stageBase}/homework/${hw.id}/edit`
                            : `${stageBase}/homework/${hw.id}`
                        }
                        className="font-medium hover:underline hover:underline-offset-4"
                      >
                        {hw.title}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        <Link
                          href={`${stageBase}/lessons/${hw.lesson.id}`}
                          className="hover:underline hover:underline-offset-4"
                        >
                          {hw.lesson.title}
                        </Link>{" "}
                        · {f.relativeDay(hw.lesson.teachingDate, today)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{due(hw.dueDate, today)}</TableCell>
                  <TableCell>
                    <HomeworkStatusBadge status={hw.status} />
                  </TableCell>
                  <TableCell>
                    {hw.counts ? (
                      <div className="flex flex-col gap-1 py-1">
                        <CompletionMeter
                          completed={hw.counts.completed}
                          assigned={hw.counts.assigned}
                        />
                        {hw.counts.withoutParentAccount > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t("childrenWithoutAccount", {
                              count: hw.counts.withoutParentAccount,
                            })}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("hiddenFromParents")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pe-4">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        <PublishHomeworkButton
                          size="sm"
                          hw={{
                            id: hw.id,
                            title: hw.title,
                            status: hw.status,
                            publishedAt: hw.publishedAt,
                            completed: hw.counts?.completed ?? 0,
                          }}
                        />
                        <HomeworkActionsMenu
                          stageBase={stageBase}
                          hw={{
                            id: hw.id,
                            title: hw.title,
                            status: hw.status,
                            publishedAt: hw.publishedAt,
                            completed: hw.counts?.completed ?? 0,
                          }}
                        />
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
