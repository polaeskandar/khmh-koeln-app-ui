"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  ChevronDown,
  CornerDownRight,
  History,
  Lock,
  ShieldCheck,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useFormat } from "@/i18n/format"
import { fold } from "@/lib/domain/names"
import type { AccessRow, ResourceAccessView } from "@/lib/view-models"

import { AssignRoleDialog } from "./assign-dialog"
import { CapabilityList, TypeIcon, useAccessLabels } from "./labels"
import { RevokeButton } from "./revoke-dialog"

const SHOWN = 6
const LARGE = 12

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground"
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

function PersonRow({
  row,
  meta,
  action,
}: {
  row: AccessRow
  meta: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar initials={row.person.initials} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          <bdi>{row.person.name}</bdi>
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            <bdi dir="ltr">{row.person.username}</bdi>
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {action}
    </li>
  )
}

function Locked({ reason }: { reason: string }) {
  const t = useTranslations("access.revoke")

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex size-9 items-center justify-center text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          aria-label={`${t("locked")}: ${reason}`}
        >
          <Lock className="size-3.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  )
}

function Capabilities({ data, roleId }: { data: ResourceAccessView; roleId: string }) {
  const t = useTranslations("access.panel")
  const groups = data.capabilities[roleId] ?? []

  return (
    <Collapsible>
      <CollapsibleTrigger className="group/caps inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        {t("canHere")}
        <ChevronDown className="size-3 transition-transform group-data-[state=open]/caps:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <CapabilityList groups={groups} />
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * People with one role: a few are listed, many (such as every member of the church) are only
 * counted until asked for, and can then be filtered.
 */
function ManyRows({
  rows,
  render,
}: {
  rows: AccessRow[]
  render: (row: AccessRow) => React.ReactNode
}) {
  const t = useTranslations("access.panel")
  const [all, setAll] = useState(false)
  const [query, setQuery] = useState("")
  const collapsed = rows.length > LARGE
  const shown = useMemo(() => {
    if (!all) {
      return collapsed ? [] : rows.slice(0, SHOWN)
    }

    const q = fold(query)

    return rows.filter((r) => fold(`${r.person.name} ${r.person.username}`).includes(q))
  }, [all, collapsed, query, rows])

  return (
    <>
      {all && rows.length > SHOWN ? (
        <div className="border-b px-4 py-2">
          <InputGroup>
            <InputGroupInput
              aria-label={t("filter")}
              placeholder={t("filter")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
        </div>
      ) : null}
      {shown.length > 0 ? <ul className="divide-y">{shown.map(render)}</ul> : null}
      {rows.length > SHOWN ? (
        <div className={cn("px-4 py-2", shown.length > 0 && "border-t")}>
          <Button variant="ghost" size="xs" onClick={() => setAll(!all)}>
            {all ? t("showLess") : t("showAll", { count: rows.length })}
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** Who has access to the selected resource, where it comes from, and what the viewer may change. */
export function ResourcePanel({ data }: { data: ResourceAccessView }) {
  const t = useTranslations("access.panel")
  const f = useFormat()
  const labels = useAccessLabels()
  const { resource } = data

  const meta = (row: AccessRow) =>
    row.origin === "owner"
      ? t("createdIt")
      : row.createdBy
        ? t("givenBy", { name: row.createdBy, date: f.mediumDate(f.instantDate(row.createdAt)) })
        : t("givenOn", { date: f.mediumDate(f.instantDate(row.createdAt)) })

  return (
    <section
      aria-labelledby="resource-title"
      className="flex min-w-0 flex-col gap-6 border bg-card p-4 md:p-6"
    >
      <header className="flex flex-col gap-4">
        {data.path.length > 0 ? (
          <nav aria-label={t("path")}>
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              {data.path.map((p) => (
                <li key={`${p.type}:${p.id}`} className="flex items-center gap-1.5">
                  {p.href ? (
                    <Link
                      href={p.href}
                      scroll={false}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <bdi>{p.name}</bdi>
                    </Link>
                  ) : (
                    <bdi>{p.name}</bdi>
                  )}
                  <span aria-hidden="true">›</span>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center border bg-muted/40">
              <TypeIcon type={resource.type} className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
                {labels.type(resource.type)}
              </span>
              <h2 id="resource-title" className="font-heading text-xl leading-tight font-semibold">
                <bdi>{resource.name}</bdi>
                {resource.detail ? (
                  <span className="ms-2 text-base font-normal text-muted-foreground">
                    {resource.detail}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-muted-foreground">{t("people", { count: data.people })}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {data.openHref ? (
              <Button asChild variant="outline">
                <Link href={data.openHref}>
                  {t("open")}
                  <ArrowUpRight data-icon="inline-end" className="rtl:-scale-x-100" />
                </Link>
              </Button>
            ) : null}
            {data.assign ? <AssignRoleDialog resource={resource} options={data.assign} /> : null}
          </div>
        </div>
        {resource.archived ? (
          <p className="border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {t("archived")}
          </p>
        ) : null}
        {!data.assign && !resource.archived ? (
          <p className="text-sm text-muted-foreground">{t("noAssign")}</p>
        ) : null}
      </header>

      <section aria-labelledby="access-direct" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="access-direct" className="font-heading text-base font-semibold">
            {t("direct")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("directHint")}</p>
        </div>
        {data.direct.length === 0 ? (
          <p className="border border-dashed p-5 text-center text-sm text-muted-foreground">
            {t("noDirect")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.direct.map((g) => (
              <div key={g.role.id} className="border">
                <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {g.role.protected ? (
                      <ShieldCheck className="size-4 text-primary" aria-label={t("protected")} />
                    ) : null}
                    <span className="font-medium">{g.role.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      · {g.rows.length}
                    </span>
                  </div>
                  <Capabilities data={data} roleId={g.role.id} />
                </div>
                <ManyRows
                  rows={g.rows}
                  render={(row) => (
                    <PersonRow
                      key={row.id}
                      row={row}
                      meta={meta(row)}
                      action={
                        row.revocable ? (
                          <RevokeButton row={row} place={resource.name} />
                        ) : row.locked ? (
                          <Locked reason={row.locked} />
                        ) : null
                      }
                    />
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {data.inherited.length > 0 ? (
        <section aria-labelledby="access-inherited" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 id="access-inherited" className="font-heading text-base font-semibold">
              {t("inherited")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("inheritedHint")}</p>
          </div>
          <div className="flex flex-col gap-3">
            {data.inherited.map((g) => (
              <div key={`${g.source.type}:${g.source.id}`} className="border border-dashed">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <CornerDownRight
                      className="size-3.5 text-muted-foreground rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                    <TypeIcon type={g.source.type} className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{t("from", { place: g.source.name })}</span>
                  </span>
                  {g.source.href ? (
                    <Link
                      href={g.source.href}
                      scroll={false}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {t("manageThere", { place: g.source.name })}
                    </Link>
                  ) : null}
                </div>
                <ManyRows
                  rows={g.rows}
                  render={(row) => (
                    <PersonRow
                      key={row.id}
                      row={row}
                      meta={
                        <span className="inline-flex items-center gap-1">
                          {row.role.protected ? (
                            <ShieldCheck className="size-3" aria-hidden="true" />
                          ) : null}
                          {row.role.name}
                        </span>
                      }
                      action={
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="flex size-9 items-center justify-center text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                              aria-label={t("inheritedLock", { place: g.source.name })}
                            >
                              <Lock className="size-3.5" aria-hidden="true" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64">
                            {t("inheritedLock", { place: g.source.name })}
                          </TooltipContent>
                        </Tooltip>
                      }
                    />
                  )}
                />
                <div className="flex flex-col gap-1 border-t border-dashed px-4 py-2">
                  {[...new Set(g.rows.map((r) => r.role.id))].map((roleId) => (
                    <div key={roleId} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">
                        {g.rows.find((r) => r.role.id === roleId)!.role.name}:
                      </span>
                      <Capabilities data={data} roleId={roleId} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.history.length > 0 ? (
        <section aria-labelledby="access-history" className="flex flex-col gap-2">
          <h3
            id="access-history"
            className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
          >
            <History className="size-3.5" aria-hidden="true" />
            {t("history")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {data.history.map((e) => (
              <li key={e.id} className={cn("flex flex-wrap gap-x-2 text-muted-foreground")}>
                <span className="tabular-nums">{f.mediumDate(f.instantDate(e.at))}</span>
                <span className="text-foreground">
                  {t(e.kind, {
                    actor: e.actor ?? t("system"),
                    person: e.person,
                    role: e.role,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
