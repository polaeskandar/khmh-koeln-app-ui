"use client"

/**
 * Who reported a homework task as done (S06). Alphabetical on purpose: no
 * ranking, no scores. "Reported done" is what a parent ticked, not verified
 * learning, and a report after the due date is just that, not a penalty.
 */
import { useMemo, useState } from "react"
import { CircleCheck, CircleDashed, Search, UserRoundX, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { MemberAvatar } from "@/components/member-avatar"
import { StatusBadge } from "@/components/status"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
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
import { matchesQuery } from "@/lib/domain/names"
import type { LocalDate } from "@/lib/domain/types"
import type { HomeworkProgress } from "@/server/queries/learning"

type Filter = "all" | "done" | "open" | "no-account"

export function CompletionTable({
  rows,
  today,
  stageName,
}: {
  rows: HomeworkProgress["rows"]
  today: LocalDate
  stageName: string
}) {
  const t = useTranslations("homework")
  const tc = useTranslations("common")
  const tn = useTranslations("counts")
  const f = useFormat()
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const counts = {
    all: rows.length,
    done: rows.filter((r) => r.status === "completed").length,
    open: rows.filter((r) => r.status === "not-completed").length,
    "no-account": rows.filter((r) => r.parentAccounts === 0).length,
  }
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "all" ||
            (filter === "done" && r.status === "completed") ||
            (filter === "open" && r.status === "not-completed") ||
            (filter === "no-account" && r.parentAccounts === 0)) &&
          (query.trim() === "" || matchesQuery(r.person, query))
      ),
    [rows, filter, query]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="all">{t("completion.tabAll", { count: counts.all })}</TabsTrigger>
            <TabsTrigger value="done">
              {t("completion.tabDone", { count: counts.done })}
            </TabsTrigger>
            <TabsTrigger value="open">
              {t("completion.tabOpen", { count: counts.open })}
            </TabsTrigger>
            <TabsTrigger value="no-account">
              {t("completion.tabNoAccount", { count: counts["no-account"] })}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="w-full lg:w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("completion.searchLabel")}
            placeholder={t("completion.searchPlaceholder")}
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

      <div className="overflow-x-auto border">
        <Table className="min-w-[680px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">{t("completion.child")}</TableHead>
              <TableHead className="w-72">{t("completion.reported")}</TableHead>
              <TableHead className="w-48 pe-4">{t("completion.parentAccounts")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  {query ? t("completion.noMatch") : t("completion.empty")}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.person.id}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3 py-1">
                      <MemberAvatar
                        name={r.person.name}
                        initials={r.person.initials}
                        seed={r.person.id}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{r.person.name}</span>
                        {!r.inStage ? (
                          <span className="text-xs text-muted-foreground">
                            {t("completion.leftStage", { stage: stageName })}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.status === "completed" ? (
                      <div className="flex flex-col items-start gap-1 py-1">
                        <StatusBadge tone="success" icon={CircleCheck}>
                          {t("completion.done")}
                        </StatusBadge>
                        <span className="text-xs text-muted-foreground">
                          {[
                            f.instantLabel(r.completedAt!, today),
                            r.completedBy,
                            r.late ? t("completion.afterDue") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    ) : (
                      <StatusBadge tone="muted" icon={CircleDashed}>
                        {t("notYet")}
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="pe-4 text-sm">
                    {r.parentAccounts > 0 ? (
                      tn("parents", { count: r.parentAccounts })
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <UserRoundX className="size-3.5" aria-hidden="true" />
                        {t("completion.noAccount")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
