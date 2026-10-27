"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, NotebookPen, Search, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFormat } from "@/i18n/format"
import { fold } from "@/lib/domain/names"
import type { LocalDate } from "@/lib/domain/types"
import type { LessonRow } from "@/server/queries/learning"

import { LessonStatusBadge, MeetingLine } from "./lesson-bits"

type Tab = "upcoming" | "previous" | "archived"

export function LessonsBrowser({
  base,
  upcoming,
  previous,
  archived,
  servants,
  today,
  canManage,
}: {
  base: string
  upcoming: LessonRow[]
  previous: LessonRow[]
  archived: LessonRow[]
  servants: { id: string; name: string }[]
  today: LocalDate
  canManage: boolean
}) {
  const t = useTranslations("lessons")
  const tc = useTranslations("common")
  const tn = useTranslations("counts")
  const f = useFormat()
  const [tab, setTab] = useState<Tab>("upcoming")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [servant, setServant] = useState("all")
  const source = tab === "upcoming" ? upcoming : tab === "previous" ? previous : archived
  const rows = useMemo(() => {
    const q = fold(query)
    return source.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (servant === "all" ||
          l.responsible.id === servant ||
          l.collaborators.some((c) => c.id === servant)) &&
        (q === "" || fold(`${l.title} ${l.passage ?? ""} ${l.teachingDate}`).includes(q))
    )
  }, [source, query, status, servant])
  const filtered = query !== "" || status !== "all" || servant !== "all"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="upcoming">
              {t("list.upcoming", { count: upcoming.length })}
            </TabsTrigger>
            <TabsTrigger value="previous">
              {t("list.previous", { count: previous.length })}
            </TabsTrigger>
            {archived.length > 0 ? (
              <TabsTrigger value="archived">
                {t("list.archived", { count: archived.length })}
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("list.search")}
              placeholder={t("list.searchPlaceholder")}
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
          <NativeSelect
            aria-label={t("fields.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="sm:w-36"
          >
            <NativeSelectOption value="all">{t("list.anyStatus")}</NativeSelectOption>
            <NativeSelectOption value="draft">{t("status.draft")}</NativeSelectOption>
            <NativeSelectOption value="ready">{t("status.ready")}</NativeSelectOption>
            <NativeSelectOption value="completed">{t("status.completed")}</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            aria-label={t("list.servant")}
            value={servant}
            onChange={(e) => setServant(e.target.value)}
            className="sm:w-44"
          >
            <NativeSelectOption value="all">{t("list.anyServant")}</NativeSelectOption>
            {servants.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>
              {filtered
                ? t("list.noMatch")
                : tab === "upcoming"
                  ? t("list.noUpcoming")
                  : tab === "previous"
                    ? t("list.noPrevious")
                    : t("list.noArchived")}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? t("list.noMatchHint")
                : tab === "upcoming"
                  ? t("list.noUpcomingHint")
                  : t("list.noPreviousHint")}
            </EmptyDescription>
          </EmptyHeader>
          {filtered ? (
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("")
                  setStatus("all")
                  setServant("all")
                }}
              >
                {t("list.clearFilters")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((l) => (
            <li key={l.id}>
              <Link
                href={`${base}/${l.id}`}
                className="-mx-2 flex items-start gap-4 px-2 py-4 hover:bg-muted/60"
              >
                <span className="w-12 shrink-0 text-center leading-none">
                  <span className="block text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {f.todayOrWeekday(l.teachingDate, today)}
                  </span>
                  <span className="mt-1 block font-heading text-xl font-semibold tabular-nums">
                    {f.dayOfMonth(l.teachingDate)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {f.monthShort(l.teachingDate)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-base font-semibold tracking-tight">
                      {l.title}
                    </span>
                    {l.passage ? (
                      <span dir="auto" className="text-sm text-muted-foreground">
                        {l.passage}
                      </span>
                    ) : null}
                  </span>
                  <MeetingLine meeting={l.meeting} today={today} />
                  <span className="text-xs text-muted-foreground">
                    {l.collaborators.length
                      ? t("list.withHelpers", {
                          name: l.responsible.name,
                          helpers: f.list(l.collaborators.map((c) => c.name)),
                        })
                      : l.responsible.name}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <LessonStatusBadge status={l.status} archived={l.archived} />
                  {l.homework.total > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <NotebookPen className="size-3.5" aria-hidden="true" />
                      {tn("homework", { count: l.homework.total })}
                      {l.homework.drafts > 0
                        ? ` · ${t("list.drafts", { count: l.homework.drafts })}`
                        : ""}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!canManage ? (
        <p className="text-xs text-muted-foreground">{t("list.onlyServants")}</p>
      ) : null}
    </div>
  )
}
