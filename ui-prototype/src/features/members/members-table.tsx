"use client"

/**
 * Minimal member management (09): who belongs where, and when they were last
 * marked present. Table toolkit from the shadcnblocks "data-table13" block;
 * on phones one row per person. Selecting a person opens their sheet.
 */
import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { CircleOff, Search, UserPlus, UsersRound, X } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableView,
  useDataTable,
} from "@/components/data-table/data-table"
import { MemberAvatar } from "@/components/member-avatar"
import { ServiceSwatch } from "@/components/service-tag"
import { StatusBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFormat } from "@/i18n/format"
import { matchesQuery } from "@/lib/domain/names"
import type { LocalDate } from "@/lib/domain/types"
import type { MemberRow, MembersPage } from "@/server/queries/members"

import { NewPersonForm } from "./member-dialogs"
import { PersonSheet } from "./person-sheet"

type Tab = "active" | "inactive" | "all"

function Placements({ row }: { row: MemberRow }) {
  const t = useTranslations("members")
  if (row.placements.length === 0)
    return <span className="text-sm text-muted-foreground">{t("noService")}</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {row.placements.map((p) => (
        <span key={p.membershipId} className="inline-flex items-center gap-1.5 text-sm">
          <ServiceSwatch tone={p.service.tone} />
          {p.stage ? p.stage.name : p.service.name}
          {p.stage ? <span className="text-muted-foreground">({p.service.name})</span> : null}
        </span>
      ))}
    </span>
  )
}

export function AddPersonDialog({ services }: { services: MembersPage["services"] }) {
  const t = useTranslations("members")
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus data-icon="inline-start" />
          {t("addPerson")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newPerson.title")}</DialogTitle>
          <DialogDescription>{t("newPerson.description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <NewPersonForm
            services={services}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function MembersTable({ data }: { data: MembersPage }) {
  const t = useTranslations("members")
  const tc = useTranslations("common")
  const f = useFormat()
  const comma = f.locale === "ar" ? "، " : ", "
  const [tab, setTab] = useState<Tab>("active")
  const [query, setQuery] = useState("")
  const [service, setService] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const today: LocalDate = data.today

  const filtered = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (tab === "all" || r.person.status === tab) &&
          (service === "" || r.placements.some((p) => p.service.id === service)) &&
          (query.trim() === "" || matchesQuery(r.person, query))
      ),
    [data.rows, tab, service, query]
  )

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => `${r.person.lastName} ${r.person.firstName}`,
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("name")} />,
        cell: ({ row: { original: r } }) => (
          <button
            type="button"
            onClick={() => setSelectedId(r.person.id)}
            className="flex min-w-0 items-center gap-3 py-1 text-start"
          >
            <MemberAvatar name={r.person.name} initials={r.person.initials} seed={r.person.id} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium hover:underline hover:underline-offset-4">
                {r.person.name}
              </span>
              {r.person.displayName ? (
                <span className="truncate text-xs text-muted-foreground">{r.person.fullName}</span>
              ) : null}
            </span>
            {r.person.status === "inactive" ? (
              <StatusBadge tone="muted" icon={CircleOff}>
                {tc("inactive")}
              </StatusBadge>
            ) : null}
          </button>
        ),
      },
      {
        id: "placements",
        header: () => <span>{t("belongsTo")}</span>,
        cell: ({ row: { original: r } }) => <Placements row={r} />,
        enableSorting: false,
      },
      {
        id: "last",
        accessorFn: (r) => r.lastAttended?.date ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("lastPresent")} />,
        cell: ({ row: { original: r } }) =>
          r.lastAttended ? (
            <span className="text-sm">
              {f.relativeDay(r.lastAttended.date, today)}{" "}
              <span className="text-muted-foreground">· {r.lastAttended.group}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{t("notYet")}</span>
          ),
        size: 220,
      },
      {
        id: "recent",
        accessorFn: (r) => r.attendedLast4Weeks,
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("last4Weeks")} />,
        cell: ({ row: { original: r } }) => (
          <span className="text-sm tabular-nums">{r.attendedLast4Weeks}</span>
        ),
        size: 120,
      },
    ],
    [today, t, tc, f]
  )

  const { table } = useDataTable({
    data: filtered,
    columns,
    getRowId: (r) => r.person.id,
    initialSorting: [{ id: "name", desc: false }],
    pageSize: 25,
  })
  const selected = data.rows.find((r) => r.person.id === selectedId) ?? null

  const empty = (
    <Empty className="py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersRound />
        </EmptyMedia>
        <EmptyTitle>{query ? t("empty.noMatch", { query }) : t("empty.title")}</EmptyTitle>
        <EmptyDescription>{query ? t("empty.noMatchHint") : t("empty.hint")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="active">
              {t("tabs.active", { count: data.counts.active })}
            </TabsTrigger>
            <TabsTrigger value="inactive">
              {t("tabs.inactive", { count: data.counts.inactive })}
            </TabsTrigger>
            <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row">
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
          <NativeSelect
            aria-label={t("service")}
            className="w-full sm:w-52"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <NativeSelectOption value="">{t("allServices")}</NativeSelectOption>
            {data.services.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Phones: one row per person. */}
      <ul className="flex flex-col divide-y border-y md:hidden">
        {filtered.length === 0 ? (
          <li>{empty}</li>
        ) : (
          table.getRowModel().rows.map(({ original: r }) => (
            <li key={r.person.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.person.id)}
                className="flex w-full items-center gap-3 py-3 text-start"
              >
                <MemberAvatar
                  name={r.person.name}
                  initials={r.person.initials}
                  seed={r.person.id}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{r.person.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.placements.map((p) => p.stage?.name ?? p.service.name).join(comma) ||
                      t("noService")}
                    {r.lastAttended
                      ? ` · ${t("lastPresentInline", { when: f.relativeDayInline(r.lastAttended.date, today) })}`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <DataTableView table={table} className="hidden md:block" emptyMessage={empty} />
      {filtered.length > 0 ? (
        <DataTablePagination
          table={table}
          summary={({ start, end, total }) => t("showing", { start, end, total })}
        />
      ) : null}
      <PersonSheet
        row={selected}
        services={data.services}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  )
}
