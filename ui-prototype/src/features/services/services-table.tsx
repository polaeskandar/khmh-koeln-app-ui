"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Archive, Search, X } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  DataTableColumnHeader,
  DataTableView,
  useDataTable,
} from "@/components/data-table/data-table"
import { ServiceSwatch } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFormat } from "@/i18n/format"
import { fold } from "@/lib/domain/names"
import type { LocalDate } from "@/lib/domain/types"
import type { ServiceRow } from "@/server/queries/services"

import { ServiceActionsMenu } from "./service-dialogs"

type Tab = "active" | "archived" | "all"

function AttendanceCell({ row }: { row: ServiceRow }) {
  const t = useTranslations("services.table")
  const tc = useTranslations("common")
  const f = useFormat()
  const { rate, averagePresent, sessions } = row.trend
  if (rate !== null) {
    return (
      <div className="flex w-28 flex-col gap-1">
        <span className="text-sm font-medium tabular-nums">{f.percent(rate)}</span>
        <span className="h-1 w-full bg-muted" aria-hidden="true">
          {/* A CSS length, not display text (German writes "82 %"). */}
          <span
            className="block h-full bg-primary"
            style={{ width: `${Math.round(rate * 100)}%` }}
          />
        </span>
      </div>
    )
  }
  if (averagePresent !== null) {
    return (
      <span className="text-sm tabular-nums">
        {t.rich("onAverage", {
          count: averagePresent,
          muted: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
        })}
      </span>
    )
  }
  return (
    <span className="text-sm text-muted-foreground">
      {sessions === 0 ? t("noSessions") : tc("dash")}
    </span>
  )
}

function NextCell({ row, today }: { row: ServiceRow; today: LocalDate }) {
  const t = useTranslations("services")
  const ts = useTranslations("status")
  const tc = useTranslations("common")
  const f = useFormat()
  if (row.archived) return <span className="text-sm text-muted-foreground">{tc("dash")}</span>
  if (!row.next) {
    return <span className="text-sm text-muted-foreground">{t("nothingPlanned")}</span>
  }
  return (
    <div className="flex flex-col">
      <span className="text-sm tabular-nums">
        {t("table.when", { day: f.relativeDay(row.next.date, today), time: row.next.startTime })}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {row.next.group === row.name
          ? row.next.status === "planned"
            ? ts("planned")
            : ts("scheduled")
          : row.next.group}
      </span>
    </div>
  )
}

export function ServicesTable({ rows, today }: { rows: ServiceRow[]; today: LocalDate }) {
  const t = useTranslations("services.table")
  const tc = useTranslations("common")
  const tn = useTranslations("counts")
  const f = useFormat()
  const listSeparator = f.locale === "ar" ? "، " : ", "
  const [tab, setTab] = useState<Tab>("active")
  const [query, setQuery] = useState("")
  const counts = {
    active: rows.filter((r) => !r.archived).length,
    archived: rows.filter((r) => r.archived).length,
    all: rows.length,
  }
  const filtered = useMemo(() => {
    const q = fold(query)
    return rows.filter(
      (r) =>
        (tab === "all" || (tab === "active" ? !r.archived : r.archived)) &&
        (q === "" || fold(`${r.name} ${r.description ?? ""} ${r.stageNames.join(" ")}`).includes(q))
    )
  }, [rows, tab, query])

  const columns = useMemo<ColumnDef<ServiceRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("service")} />,
        cell: ({ row: { original: r } }) => (
          <div className="flex min-w-0 items-start gap-3 py-1">
            <ServiceSwatch tone={r.tone} className="mt-1.5 size-2.5" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <Link
                  href={`/services/${r.id}`}
                  className="font-medium hover:underline hover:underline-offset-4"
                >
                  {r.name}
                </Link>
                {r.archived ? (
                  <StatusBadge
                    tone="muted"
                    icon={Archive}
                    title={
                      r.archivedAt
                        ? t("archivedOn", { date: f.mediumDate(r.archivedAt.slice(0, 10)) })
                        : undefined
                    }
                  >
                    {tc("archived")}
                  </StatusBadge>
                ) : null}
              </span>
              {r.description ? (
                <span
                  dir="auto"
                  className="block max-w-[46ch] truncate text-xs text-muted-foreground"
                >
                  {r.description}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "stageCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("stages")} />,
        cell: ({ row: { original: r } }) => (
          <span className="tabular-nums" title={r.stageNames.join(listSeparator)}>
            {r.stageCount === 0 ? (
              <span className="text-muted-foreground">{tc("none")}</span>
            ) : (
              r.stageCount
            )}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: "memberCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("members")} />,
        cell: ({ row: { original: r } }) => <span className="tabular-nums">{r.memberCount}</span>,
        size: 100,
      },
      {
        id: "next",
        header: () => <span className="flex h-8 items-center">{t("next")}</span>,
        cell: ({ row: { original: r } }) => <NextCell row={r} today={today} />,
        size: 170,
      },
      {
        id: "attendance",
        header: () => (
          <span className="flex h-8 items-center" title={t("attendanceHint")}>
            {t("attendance")}
          </span>
        ),
        cell: ({ row: { original: r } }) => <AttendanceCell row={r} />,
        size: 150,
      },
      {
        id: "leaders",
        header: () => <span className="flex h-8 items-center">{t("leaders")}</span>,
        cell: ({ row: { original: r } }) => (
          <span className="line-clamp-2 text-sm">
            {r.leaders.length ? (
              r.leaders.map((l) => l.name).join(listSeparator)
            ) : (
              <span className="text-muted-foreground">{tc("dash")}</span>
            )}
          </span>
        ),
        size: 170,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: ({ row: { original: r } }) => (
          <div className="flex justify-end">
            <ServiceActionsMenu
              service={{ id: r.id, name: r.name, description: r.description }}
              archived={r.archived}
              impact={r.impact}
              can={r.can}
            />
          </div>
        ),
        size: 56,
      },
    ],
    [today, t, tc, f, listSeparator]
  )

  const { table } = useDataTable({
    data: filtered,
    columns,
    getRowId: (r) => r.id,
    initialSorting: [{ id: "name", desc: false }],
    pageSize: 50,
  })

  const empty = (
    <Empty className="py-6">
      <EmptyHeader>
        <EmptyTitle>
          {query ? t("noMatch", { query }) : tab === "archived" ? t("noArchived") : t("none")}
        </EmptyTitle>
        <EmptyDescription>{query ? t("checkSpelling") : t("appearHere")}</EmptyDescription>
      </EmptyHeader>
      {query ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            {tc("clearSearch")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="active">{t("tabs.active", { count: counts.active })}</TabsTrigger>
            <TabsTrigger value="archived">
              {t("tabs.archived", { count: counts.archived })}
            </TabsTrigger>
            <TabsTrigger value="all">{t("tabs.all", { count: counts.all })}</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("search")}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={tc("clearSearch")}
                onClick={() => setQuery("")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>

      {/* Phones: one card per service. */}
      <ul className="flex flex-col divide-y border-y md:hidden">
        {filtered.length === 0 ? (
          <li>{empty}</li>
        ) : (
          table.getRowModel().rows.map(({ original: r }) => (
            <li key={r.id} className="flex items-start gap-3 py-3">
              <ServiceSwatch tone={r.tone} className="mt-1.5 size-2.5" />
              <Link href={`/services/${r.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  {r.name}
                  {r.archived ? (
                    <StatusBadge tone="muted" icon={Archive}>
                      {tc("archived")}
                    </StatusBadge>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    r.stageCount > 0 ? tn("stages", { count: r.stageCount }) : null,
                    tn("members", { count: r.memberCount }),
                    r.next && !r.archived
                      ? t("nextAt", {
                          when: f.relativeDayInline(r.next.date, today),
                          time: r.next.startTime,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
              <ServiceActionsMenu
                service={{ id: r.id, name: r.name, description: r.description }}
                archived={r.archived}
                impact={r.impact}
                can={r.can}
              />
            </li>
          ))
        )}
      </ul>

      <DataTableView table={table} className="hidden md:block" emptyMessage={empty} />
    </div>
  )
}
