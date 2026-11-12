"use client"

import { startTransition, useMemo, useOptimistic, useState } from "react"
import { Check, Lock, LockOpen, PlayCircle, Search, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog, ReasonDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { fold } from "@/lib/domain/names"
import type { PersonRef } from "@/lib/view-models"
import {
  closeSessionAction,
  openSessionAction,
  reopenSessionAction,
  searchPeopleAction,
  setPresentAction,
} from "@/server/actions/attendance"
import type { getSessionPage } from "@/server/queries/attendance"

type Page = ReturnType<typeof getSessionPage>
type Row = Page["roster"][number]

function PersonRow({
  row,
  editable,
  onToggle,
}: {
  row: Row
  editable: boolean
  onToggle: () => void
}) {
  const t = useTranslations("attendance.board")
  const f = useFormat()

  return (
    <li className={cn("flex items-center gap-3 px-1 py-2", row.present && "bg-success-soft/40")}>
      <MemberAvatar name={row.person.name} initials={row.person.initials} seed={row.person.id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{row.person.name}</span>
        {row.present && row.recordedAt ? (
          <span className="truncate text-xs text-muted-foreground">
            {t("markedAt", { time: f.instantTime(row.recordedAt) })}
            {row.recordedBy ? ` · ${row.recordedBy.name}` : ""}
          </span>
        ) : null}
      </div>
      {editable ? (
        <Button
          variant={row.present ? "default" : "outline"}
          size="sm"
          aria-pressed={row.present}
          aria-label={
            row.present
              ? t("unmark", { name: row.person.name })
              : t("mark", { name: row.person.name })
          }
          onClick={onToggle}
          className="min-w-28"
        >
          {row.present ? <Check data-icon="inline-start" /> : null}
          {row.present ? t("present") : t("markPresent")}
        </Button>
      ) : row.present ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider text-success uppercase">
          <Check className="size-3.5" />
          {t("present")}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{t("notMarked")}</span>
      )}
    </li>
  )
}

function AddVisitor({ sessionId, onAdded }: { sessionId: string; onAdded: () => void }) {
  const t = useTranslations("attendance.board")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<(PersonRef & { groups: string[] })[]>([])
  const mark = useServerAction(setPresentAction, { toastOnSuccess: false })

  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <UserPlus />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={t("visitorPlaceholder")}
          aria-label={t("visitor")}
          value={query}
          onChange={async (e) => {
            setQuery(e.target.value)
            setResults(
              e.target.value.trim().length >= 2 ? await searchPeopleAction(e.target.value) : []
            )
          }}
        />
      </InputGroup>
      {results.length > 0 ? (
        <ul className="divide-y border">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.groups.join(" · ")}
                </span>
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={async () => {
                  const result = await mark.execute(sessionId, p.id, true)

                  if (result.ok) {
                    setQuery("")
                    setResults([])
                    onAdded()
                  }
                }}
              >
                {t("markPresent")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function AttendanceBoard({ page }: { page: Page }) {
  const t = useTranslations("attendance.board")
  const { session } = page
  const [filter, setFilter] = useState("")
  const [, refresh] = useState(0)
  const [optimistic, setOptimistic] = useOptimistic(
    page.roster,
    (rows: Row[], change: { personId: string; present: boolean }) =>
      rows.map((r) => (r.person.id === change.personId ? { ...r, present: change.present } : r))
  )
  const toggle = useServerAction(setPresentAction, { toastOnSuccess: false })
  const open = useServerAction(openSessionAction)
  const close = useServerAction(closeSessionAction)
  const reopen = useServerAction(reopenSessionAction)
  const editable = session.status === "open" && page.can.record
  const present = optimistic.filter((r) => r.present).length + page.visitors.length + page.anonymous
  const shown = useMemo(
    () => optimistic.filter((r) => fold(r.person.name).includes(fold(filter))),
    [optimistic, filter]
  )
  const canOpen = session.status === "scheduled" && session.date === page.today && page.can.record

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border bg-card p-4">
        <div className="flex flex-col">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {t("count", { present, roster: page.roster.length })}
          </span>
          <span className="text-sm text-muted-foreground">
            {page.visitors.length > 0
              ? t("visitors", { count: page.visitors.length })
              : t("counted")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpen ? (
            <Button onClick={() => open.execute(session.id)} disabled={open.pending}>
              <PlayCircle data-icon="inline-start" />
              {t("open")}
            </Button>
          ) : null}
          {session.status === "open" && page.can.record ? (
            <ConfirmDialog
              trigger={
                <Button>
                  <Lock data-icon="inline-start" />
                  {t("close")}
                </Button>
              }
              title={t("closeTitle")}
              description={t("closeHint", { present, roster: page.roster.length })}
              confirmLabel={t("close")}
              onConfirm={async () => (await close.execute(session.id)).ok}
            />
          ) : null}
          {session.status === "closed" && page.can.correct ? (
            <ReasonDialog
              trigger={
                <Button variant="outline">
                  <LockOpen data-icon="inline-start" />
                  {t("reopen")}
                </Button>
              }
              title={t("reopenTitle")}
              description={t("reopenHint")}
              reasonLabel={t("reopenReason")}
              requireReason
              confirmLabel={t("reopen")}
              onConfirm={async (reason) => (await reopen.execute(session.id, reason ?? "")).ok}
            />
          ) : null}
        </div>
      </div>
      {session.status === "scheduled" && !canOpen ? (
        <p className="border border-dashed p-4 text-sm text-muted-foreground">
          {session.date > page.today ? t("notYet") : t("neverOpened")}
        </p>
      ) : null}
      {session.status === "canceled" ? null : (
        <section className="flex flex-col gap-3" aria-labelledby="roster">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="roster" className="font-heading font-semibold">
              {t("roster")}
            </h2>
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t("filter")}
                aria-label={t("filter")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </InputGroup>
          </div>
          <ul className="divide-y border px-3">
            {shown.map((row) => (
              <PersonRow
                key={row.person.id}
                row={row}
                editable={editable}
                onToggle={() =>
                  startTransition(async () => {
                    setOptimistic({ personId: row.person.id, present: !row.present })
                    await toggle.execute(session.id, row.person.id, !row.present)
                  })
                }
              />
            ))}
            {shown.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">{t("nobody")}</li>
            ) : null}
          </ul>
          {page.visitors.length > 0 ? (
            <>
              <h3 className="pt-2 text-sm font-semibold">{t("notOnRoster")}</h3>
              <ul className="divide-y border px-3">
                {page.visitors.map((row) => (
                  <PersonRow
                    key={row.person.id}
                    row={row}
                    editable={editable}
                    onToggle={() => toggle.execute(session.id, row.person.id, false)}
                  />
                ))}
              </ul>
            </>
          ) : null}
          {editable ? (
            <AddVisitor sessionId={session.id} onAdded={() => refresh((x) => x + 1)} />
          ) : null}
        </section>
      )}
    </div>
  )
}
