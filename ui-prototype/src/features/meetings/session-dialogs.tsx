"use client"

/**
 * Changes to one session or one planned date: move it, rename it, cancel it.
 * Each affects only that date; the schedule and its other dates stay as they
 * are. Dialog pattern from the shadcnblocks "alert-dialog-form-2" example.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CalendarClock, Ellipsis, PencilLine } from "lucide-react"
import { useTranslations } from "next-intl"

import { ReasonDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import type { LocalDate, LocalTime } from "@/lib/domain/types"
import type { ActionResult } from "@/server/errors"
import {
  cancelOccurrenceAction,
  cancelSessionAction,
  editSessionAction,
  moveOccurrenceAction,
  moveSessionAction,
} from "@/server/actions/meetings"

type Times = { date: LocalDate; startTime: LocalTime; endTime: LocalTime | null }

function MoveDialog({
  open,
  onOpenChange,
  title,
  initial,
  submit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial: Times
  submit: (input: Times) => Promise<ActionResult<unknown>>
}) {
  const t = useTranslations("meetings")
  const tc = useTranslations("common")
  const [date, setDate] = useState(initial.date)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime ?? "")
  const action = useServerAction(submit, { onSuccess: () => onOpenChange(false) })
  const errors = action.fieldErrors
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDate(initial.date)
          setStartTime(initial.startTime)
          setEndTime(initial.endTime ?? "")
          action.reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("dialogs.moveDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="move-form"
          onSubmit={(e) => {
            e.preventDefault()
            action.execute({ date, startTime, endTime: endTime || null })
          }}
        >
          <FieldGroup>
            <TextField
              label={t("fields.date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              error={errors.date}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label={t("fields.starts")}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                error={errors.startTime}
              />
              <TextField
                label={t("fields.ends")}
                optional
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                error={errors.endTime}
              />
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={action.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="move-form" disabled={action.pending}>
            {action.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("dialogs.move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({
  open,
  onOpenChange,
  sessionId,
  title: initialTitle,
  location: initialLocation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  title: string
  location: string | null
}) {
  const t = useTranslations("meetings")
  const tc = useTranslations("common")
  const [title, setTitle] = useState(initialTitle)
  const [location, setLocation] = useState(initialLocation ?? "")
  const action = useServerAction(editSessionAction, { onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTitle(initialTitle)
          setLocation(initialLocation ?? "")
          action.reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogs.editTitle")}</DialogTitle>
          <DialogDescription>{t("dialogs.editDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="edit-session-form"
          onSubmit={(e) => {
            e.preventDefault()
            action.execute(sessionId, { title, location: location || null })
          }}
        >
          <FieldGroup>
            <TextField
              label={t("fields.title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              error={action.fieldErrors.title}
            />
            <TextField
              label={t("fields.place")}
              optional
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder={t("fields.placePlaceholder")}
              error={action.fieldErrors.location}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={action.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="edit-session-form" disabled={action.pending}>
            {action.pending ? <Spinner data-icon="inline-start" /> : null}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Session page: move, rename or cancel a session that has not started. */
export function SessionManageMenu({
  session,
}: {
  session: {
    id: string
    title: string
    group: string
    location: string | null
    date: LocalDate
    startTime: LocalTime
    endTime: LocalTime | null
  }
}) {
  const t = useTranslations("meetings")
  const f = useFormat()
  const [dialog, setDialog] = useState<"move" | "edit" | "cancel" | null>(null)
  const cancel = useServerAction(cancelSessionAction)
  const open = (d: typeof dialog) => (next: boolean) => setDialog(next ? d : null)
  const when = { group: session.group, date: f.dayMonth(session.date) }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("dialogs.sessionMenu")}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setDialog("move")}>
            <CalendarClock />
            {t("dialogs.moveSession")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <PencilLine />
            {t("dialogs.editSession")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
            <Ban />
            {t("dialogs.cancelSession")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MoveDialog
        open={dialog === "move"}
        onOpenChange={open("move")}
        title={t("dialogs.moveTitle", when)}
        initial={{ date: session.date, startTime: session.startTime, endTime: session.endTime }}
        submit={(input) => moveSessionAction(session.id, input)}
      />
      <EditDialog
        open={dialog === "edit"}
        onOpenChange={open("edit")}
        sessionId={session.id}
        title={session.title}
        location={session.location}
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={open("cancel")}
        title={t("dialogs.cancelTitle", when)}
        description={t("dialogs.cancelSessionDescription")}
        reasonHint={t("dialogs.cancelReasonHint")}
        placeholder={t("dialogs.cancelReasonPlaceholder")}
        confirmLabel={t("dialogs.confirmCancelSession")}
        dismissLabel={t("dialogs.keepSession")}
        tone="destructive"
        onConfirm={async (reason) => (await cancel.execute(session.id, reason)).ok}
      />
    </>
  )
}

/**
 * A planned date of a schedule (no session yet): cancel or move it ahead of
 * time. `group` names whose meeting it is (the stage, or the whole service).
 */
export function OccurrenceMenu({
  scheduleId,
  group,
  times,
}: {
  scheduleId: string
  group: string
  times: Times
}) {
  const router = useRouter()
  const t = useTranslations("meetings")
  const f = useFormat()
  const [dialog, setDialog] = useState<"move" | "cancel" | null>(null)
  const cancel = useServerAction(cancelOccurrenceAction, { onSuccess: () => router.refresh() })
  const open = (d: typeof dialog) => (next: boolean) => setDialog(next ? d : null)
  // "Sunday 15 November": the long date without the year.
  const when = { group, date: f.longDate(times.date).replace(/ \d{4}$/, "") }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("dialogs.dateMenu", when)}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setDialog("move")}>
            <CalendarClock />
            {t("dialogs.moveDate")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
            <Ban />
            {t("dialogs.cancelDate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MoveDialog
        open={dialog === "move"}
        onOpenChange={open("move")}
        title={t("dialogs.moveTitle", when)}
        initial={times}
        submit={(input) => moveOccurrenceAction(scheduleId, times.date, input)}
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={open("cancel")}
        title={t("dialogs.cancelTitle", when)}
        description={t("dialogs.cancelDateDescription")}
        placeholder={t("dialogs.cancelReasonPlaceholder")}
        confirmLabel={t("dialogs.cancelDate")}
        dismissLabel={t("dialogs.keepDate")}
        tone="destructive"
        onConfirm={async (reason) => (await cancel.execute(scheduleId, times.date, reason)).ok}
      />
    </>
  )
}
