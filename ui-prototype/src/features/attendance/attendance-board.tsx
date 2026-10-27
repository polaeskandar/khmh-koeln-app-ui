"use client"

/**
 * Manual attendance (07, and 10 on phones). One tap marks a person present;
 * the tick shows at once and the server confirms it. "Not marked present" is
 * never called absent: people may have been there without being ticked.
 */
import { startTransition, useMemo, useOptimistic, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Search, Undo2, UserPlus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { cn } from "cn"

import { ConfirmDialog, ReasonDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { RosterCells } from "@/components/roster-cells"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { matchesQuery } from "@/lib/domain/names"
import type { AttendanceEntry, PersonRef } from "@/lib/view-models"
import { closeSessionAction } from "@/server/actions/meetings"
import { markPresentAction, removeAttendanceAction } from "@/server/actions/people"
import type { AttendanceBoard as Board } from "@/server/queries/attendance"
import { isolate } from "@/lib/bidi"

type Row = { person: PersonRef; entry: AttendanceEntry | null; placements: string[] }
type Present = Map<string, { id: string | null; recordedAt: string | null; by: string | null }>
type Mark = { personId: string; present: boolean }

function PersonRow({
  row,
  mark,
  onMark,
  onUndo,
  canRecord,
  showPlacements,
}: {
  row: Row
  mark: { id: string | null; recordedAt: string | null } | undefined
  onMark: () => void
  onUndo: () => void
  canRecord: boolean
  showPlacements?: boolean
}) {
  const t = useTranslations("attendance.board")
  const f = useFormat()
  const present = !!mark
  return (
    <li className={cn("flex items-center gap-3 py-2.5", present && "bg-success-soft/40")}>
      <MemberAvatar
        name={row.person.name}
        initials={row.person.initials}
        seed={row.person.id}
        className="ms-1"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{row.person.name}</span>
        {showPlacements ? (
          <span className="truncate text-xs text-muted-foreground">
            {row.placements.length ? row.placements.join(" · ") : t("noGroup")}
          </span>
        ) : row.person.displayName ? (
          <span className="truncate text-xs text-muted-foreground">{row.person.fullName}</span>
        ) : null}
      </span>
      {present ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden="true" />
            <span>
              {t("present")}
              <span className="hidden sm:inline">
                {mark.recordedAt ? ` · ${f.instantTime(mark.recordedAt)}` : ""}
              </span>
            </span>
          </span>
          {canRecord ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("undo", { name: row.person.name })}
              onClick={onUndo}
              disabled={!mark.id}
            >
              <Undo2 />
            </Button>
          ) : null}
        </span>
      ) : canRecord ? (
        <Button
          variant="outline"
          className="h-10 w-32 shrink-0"
          onClick={onMark}
          aria-label={t("mark", { name: row.person.name })}
        >
          {t("present")}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">{t("notMarked")}</span>
      )}
    </li>
  )
}

export function AttendanceBoard({ board }: { board: Board }) {
  const t = useTranslations("attendance.board")
  const tc = useTranslations("common")
  const f = useFormat()
  const router = useRouter()
  const s = board.session
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "open" | "present">("all")
  const [closing, setClosing] = useState(false)
  const [correcting, setCorrecting] = useState<AttendanceEntry | null>(null)
  const close = useServerAction(closeSessionAction, {
    onSuccess: () => router.push(`/attendance/${s.id}/summary`),
  })
  const correct = useServerAction(removeAttendanceAction)

  const serverPresent: Present = useMemo(
    () =>
      new Map(
        board.present.map((e) => [
          e.person.id,
          { id: e.id, recordedAt: e.recordedAt, by: e.recordedBy?.name ?? null },
        ])
      ),
    [board.present]
  )
  const [present, applyMark] = useOptimistic(serverPresent, (state: Present, m: Mark) => {
    const next = new Map(state)
    if (m.present) next.set(m.personId, { id: null, recordedAt: null, by: null })
    else next.delete(m.personId)
    return next
  })

  const markPresent = (row: Row) =>
    startTransition(async () => {
      applyMark({ personId: row.person.id, present: true })
      const r = await markPresentAction(s.id, row.person.id)
      if (!r.ok) toast.error(r.problem.detail ?? r.problem.title)
    })
  const undo = (row: Row) => {
    const id = present.get(row.person.id)?.id
    if (!id) return
    startTransition(async () => {
      applyMark({ personId: row.person.id, present: false })
      const r = await removeAttendanceAction(id, null)
      if (!r.ok) toast.error(r.problem.detail ?? r.problem.title)
    })
  }

  const expected = s.rosterMode === "expected"
  const rosterPresent = board.roster.filter((r) => present.has(r.person.id)).length
  const extraRows = board.others.filter((r) => present.has(r.person.id))
  const notMarked = board.roster.length - rosterPresent
  const q = query.trim()
  const visibleRoster = board.roster.filter(
    (r) =>
      (filter === "all" ||
        (filter === "present" ? present.has(r.person.id) : !present.has(r.person.id))) &&
      (q === "" || matchesQuery(r.person, q))
  )
  const visibleExtra = extraRows.filter(
    (r) => filter !== "open" && (q === "" || matchesQuery(r.person, q))
  )
  const others =
    q.length >= 2
      ? board.others
          .filter((r) => !present.has(r.person.id) && matchesQuery(r.person, q))
          .slice(0, 8)
      : []
  const total = present.size
  const canRecord = board.can.record

  // The big number is part of the sentence: its place in it depends on the language.
  const num = (chunks: React.ReactNode) => (
    <span className="font-heading text-3xl font-semibold text-foreground tabular-nums">
      {chunks}
    </span>
  )
  const counter = (
    <span className="text-sm text-muted-foreground">
      {expected
        ? t.rich("counter", { present: rosterPresent, total: board.roster.length, num })
        : t.rich("counterOpen", { count: total, num })}
      {expected && extraRows.length ? ` · ${t("notOnRoster", { count: extraRows.length })}` : null}
    </span>
  )

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:pb-0">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="sticky top-14 z-10 -mx-4 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("find")}
              placeholder={expected ? t("findOnRoster") : t("find")}
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
          {expected ? (
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="all">{t("tabAll", { count: board.roster.length })}</TabsTrigger>
                <TabsTrigger value="open">{t("tabOpen", { count: notMarked })}</TabsTrigger>
                <TabsTrigger value="present">
                  {t("tabPresent", { count: rosterPresent })}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>

        {expected ? (
          <section aria-label={t("roster")}>
            {visibleRoster.length === 0 ? (
              <p className="border border-dashed p-4 text-sm text-muted-foreground">
                {q ? t("noRosterMatch") : filter === "open" ? t("everyoneMarked") : t("nobodyYet")}
              </p>
            ) : (
              <ul className="divide-y border-y">
                {visibleRoster.map((row) => (
                  <PersonRow
                    key={row.person.id}
                    row={row}
                    mark={present.get(row.person.id)}
                    onMark={() => markPresent(row)}
                    onUndo={() => undo(row)}
                    canRecord={canRecord}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {visibleExtra.length > 0 || (!expected && present.size > 0) ? (
          <section
            className="flex flex-col gap-2"
            aria-label={expected ? t("presentNotOnRoster") : t("presentList")}
          >
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {expected ? t("presentNotOnRoster") : t("presentList")}
            </h2>
            <ul className="divide-y border-y">
              {(expected
                ? visibleExtra
                : board.others.concat(board.roster).filter((r) => present.has(r.person.id))
              ).map((row) => (
                <PersonRow
                  key={row.person.id}
                  row={row}
                  mark={present.get(row.person.id)}
                  onMark={() => markPresent(row)}
                  onUndo={() => undo(row)}
                  canRecord={canRecord}
                  showPlacements
                />
              ))}
            </ul>
          </section>
        ) : null}

        {canRecord ? (
          <section className="flex flex-col gap-2" aria-label={t("addSomeone")}>
            <h2 className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <UserPlus className="size-3.5" aria-hidden="true" />
              {expected ? t("someoneNotOnRoster") : t("markSomeone")}
            </h2>
            {q.length < 2 ? (
              <p className="text-sm text-muted-foreground">{t("typeTwoLetters")}</p>
            ) : others.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOtherMatch", { query: q })}</p>
            ) : (
              <ul className="divide-y border-y">
                {others.map((row) => (
                  <PersonRow
                    key={row.person.id}
                    row={row}
                    mark={present.get(row.person.id)}
                    onMark={() => markPresent(row)}
                    onUndo={() => undo(row)}
                    canRecord={canRecord}
                    showPlacements
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <aside className="hidden min-w-0 flex-col gap-5 self-start lg:sticky lg:top-20 lg:flex">
        <div className="flex flex-col gap-3 border p-5">
          <p>{counter}</p>
          {expected && board.roster.length > 0 ? (
            <RosterCells
              filled={rosterPresent}
              total={board.roster.length}
              extra={extraRows.length}
              size="md"
            />
          ) : null}
          {expected ? (
            <p className="text-sm text-muted-foreground">
              {notMarked === 0 ? t("everyoneMarked") : t("notMarkedYet", { count: notMarked })}
            </p>
          ) : null}
          {canRecord ? (
            <Button onClick={() => setClosing(true)} disabled={close.pending}>
              {t("close")}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("viewOnly")}</p>
          )}
        </div>
        {board.present.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={t("recent")}>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("recent")}
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {board.present.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{e.person.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {f.instantTime(e.recordedAt)}
                    {e.recordedBy ? ` · ${e.recordedBy.name.split(" ")[0]}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {canRecord ? (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => setCorrecting(board.present[0])}
              >
                {t("correctMistake")}
              </button>
            ) : null}
          </section>
        ) : null}
        {board.removed.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={t("corrections")}>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("corrections")}
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {board.removed.slice(0, 4).map((e) => {
                const removal = {
                  name: e.person.name,
                  when: e.removedAt ? f.atLabel(e.removedAt, board.today) : "",
                }
                return (
                  <li key={e.id}>
                    {e.removalReason
                      ? t("removedReason", { ...removal, reason: isolate(e.removalReason) })
                      : t("removed", removal)}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </aside>

      {/* Phones: the count and the close button stay in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <p className="flex-1 leading-tight">{counter}</p>
        {canRecord ? (
          <Button onClick={() => setClosing(true)} disabled={close.pending}>
            {t("closeShort")}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={t("confirm.title", { group: s.group })}
        description={t("confirm.description")}
        consequences={[
          expected
            ? t("confirm.presentOf", { present: rosterPresent, total: board.roster.length })
            : t("confirm.present", { count: total }),
          ...(extraRows.length ? [t("confirm.extra", { count: extraRows.length })] : []),
          ...(expected && notMarked > 0 ? [t("confirm.notMarked", { count: notMarked })] : []),
        ]}
        confirmLabel={t("close")}
        onConfirm={async () => (await close.execute(s.id)).ok}
      />
      <ReasonDialog
        open={!!correcting}
        onOpenChange={(open) => !open && setCorrecting(null)}
        title={t("correct.title")}
        description={t("correct.description")}
        reasonLabel={t("correct.note")}
        placeholder={t("correct.placeholder")}
        confirmLabel={t("correct.confirm")}
        tone="destructive"
        onConfirm={async (reason) => {
          if (!correcting) return true
          return (await correct.execute(correcting.id, reason)).ok
        }}
      >
        {correcting ? (
          <NativeSelect
            aria-label={t("correct.person")}
            className="w-full"
            value={correcting.id}
            onChange={(e) =>
              setCorrecting(board.present.find((x) => x.id === e.target.value) ?? null)
            }
          >
            {board.present.map((e) => (
              <NativeSelectOption key={e.id} value={e.id}>
                {e.person.name} · {f.instantTime(e.recordedAt)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
      </ReasonDialog>
    </div>
  )
}
