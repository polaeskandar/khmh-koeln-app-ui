"use client"

import { useState } from "react"
import Link from "next/link"
import { Ban, CalendarClock, ClipboardCheck, MoreHorizontal, Plus, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ReasonDialog } from "@/components/confirm-dialog"
import { OptionalInput, TextField } from "@/components/form-fields"
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
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import type { SessionCard } from "@/lib/view-models"
import type { ActionResult } from "@/server/errors"
import {
  addOneOffSessionAction,
  cancelSessionAction,
  rescheduleSessionAction,
  restoreSessionAction,
} from "@/server/actions/schedule"

type Times = { date: string; startTime: string; endTime: string | null; location: string | null }

function TimesDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initial: Times
  submitLabel: string
  onSubmit: (times: Times) => Promise<ActionResult<unknown>>
}) {
  const t = useTranslations("schedule.times")
  const tc = useTranslations("common")
  const [value, setValue] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)

        if (next) {
          setValue(initial)
          setErrors({})
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault()
            setPending(true)
            const result = await onSubmit(value)
            setPending(false)

            if (result.ok) {
              onOpenChange(false)
            } else {
              setErrors(result.problem.fieldErrors ?? {})
            }
          }}
        >
          <TextField
            type="date"
            label={t("date")}
            value={value.date}
            onChange={(e) => setValue({ ...value, date: e.target.value })}
            error={errors.date}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField
              type="time"
              label={t("start")}
              value={value.startTime}
              onChange={(e) => setValue({ ...value, startTime: e.target.value })}
              error={errors.startTime}
            />
            <OptionalInput
              type="time"
              label={t("end")}
              value={value.endTime}
              onChange={(endTime) => setValue({ ...value, endTime })}
              error={errors.endTime}
            />
          </div>
          <OptionalInput
            type="text"
            label={t("location")}
            value={value.location}
            onChange={(location) => setValue({ ...value, location })}
            error={errors.location}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddOneOffButton({
  scheduleId,
  unitName,
  defaults,
}: {
  scheduleId: string
  unitName: string
  defaults: Times
}) {
  const t = useTranslations("schedule.oneOff")
  const [open, setOpen] = useState(false)
  const { execute } = useServerAction(addOneOffSessionAction)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {t("add")}
      </Button>
      <TimesDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description", { name: unitName })}
        initial={defaults}
        submitLabel={t("add")}
        onSubmit={(times) => execute(scheduleId, times)}
      />
    </>
  )
}

export function SessionMenu({ session, today }: { session: SessionCard; today: string }) {
  const t = useTranslations("schedule.session")
  const tc = useTranslations("common")
  const f = useFormat()
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null)
  const reschedule = useServerAction(rescheduleSessionAction)
  const cancel = useServerAction(cancelSessionAction)
  const restore = useServerAction(restoreSessionAction)
  const future = session.date >= today
  const label = `${session.unit.name}, ${f.dayMonth(session.date)}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={tc("actionsFor", { name: label })}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {session.status !== "canceled" ? (
            <DropdownMenuItem asChild>
              <Link href={`/attendance/${session.id}`}>
                <ClipboardCheck />
                {t("attendance")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {session.canManage && future && session.status === "scheduled" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog("reschedule")}>
                <CalendarClock />
                {t("reschedule")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                <Ban />
                {t("cancel")}
              </DropdownMenuItem>
            </>
          ) : null}
          {session.canManage && future && session.status === "canceled" ? (
            <DropdownMenuItem onSelect={() => restore.execute(session.id)}>
              <Undo2 />
              {t("restore")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <TimesDialog
        open={dialog === "reschedule"}
        onOpenChange={(open) => setDialog(open ? "reschedule" : null)}
        title={t("rescheduleTitle")}
        description={t("rescheduleDescription", { name: label })}
        initial={{
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          location: session.location,
        }}
        submitLabel={t("reschedule")}
        onSubmit={(times) => reschedule.execute(session.id, times)}
      />
      <ReasonDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        title={t("cancelTitle", { name: label })}
        description={t("cancelDescription")}
        reasonLabel={t("cancelReason")}
        confirmLabel={t("cancel")}
        dismissLabel={t("keep")}
        tone="destructive"
        onConfirm={async (reason) => (await cancel.execute(session.id, reason || null)).ok}
      />
    </>
  )
}
