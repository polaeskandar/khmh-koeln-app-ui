"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CirclePause, CirclePlay, Ellipsis, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import type { LocalDate } from "@/lib/domain/types"
import type { ScheduleSummary } from "@/lib/view-models"
import { deleteScheduleAction, setScheduleActiveAction } from "@/server/actions/meetings"
import type { FormService } from "@/server/queries/meetings"

import { ScheduleDialog } from "./schedule-dialog"

/** Edit, pause or delete a schedule. Deleting is only possible before any session exists. */
export function ScheduleActions({
  schedule,
  services,
  today,
  blocked,
}: {
  schedule: ScheduleSummary
  services: FormService[]
  today: LocalDate
  /** Why the schedule can't be activated (archived service or stage), if so. */
  blocked: string | null
}) {
  const router = useRouter()
  const t = useTranslations("meetings")
  const tc = useTranslations("common")
  const [dialog, setDialog] = useState<"edit" | "pause" | "delete" | null>(null)
  const toggle = useServerAction(setScheduleActiveAction)
  const remove = useServerAction(deleteScheduleAction, {
    onSuccess: () => router.push("/meetings/schedules"),
  })
  const open = (d: typeof dialog) => (next: boolean) => setDialog(next ? d : null)

  return (
    <>
      <Button variant="outline" onClick={() => setDialog("edit")}>
        <Pencil data-icon="inline-start" />
        {t("actions.edit")}
      </Button>
      {schedule.active ? null : (
        <Button
          disabled={toggle.pending || !!blocked}
          title={blocked ?? undefined}
          onClick={() => toggle.execute(schedule.id, true)}
        >
          {toggle.pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CirclePlay data-icon="inline-start" />
          )}
          {t("actions.activate")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={tc("moreActions")}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {schedule.active ? (
            <DropdownMenuItem onSelect={() => setDialog("pause")}>
              <CirclePause />
              {t("actions.deactivate")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={schedule.sessionCount > 0}
            onSelect={() => setDialog("delete")}
          >
            <Trash2 />
            {schedule.sessionCount > 0 ? t("actions.cantDelete") : t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ScheduleDialog
        services={services}
        today={today}
        schedule={schedule}
        trigger={null}
        open={dialog === "edit"}
        onOpenChange={open("edit")}
      />
      <ConfirmDialog
        open={dialog === "pause"}
        onOpenChange={open("pause")}
        title={t("actions.deactivateTitle", { name: schedule.name })}
        description={t("actions.deactivateDescription")}
        consequences={[
          t("actions.deactivateExisting"),
          t("actions.deactivateHistory", { count: schedule.sessionCount }),
        ]}
        confirmLabel={t("actions.deactivate")}
        onConfirm={async () => (await toggle.execute(schedule.id, false)).ok}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={open("delete")}
        title={t("actions.deleteTitle", { name: schedule.name })}
        description={t("actions.deleteDescription")}
        tone="destructive"
        confirmLabel={t("actions.delete")}
        onConfirm={async () => (await remove.execute(schedule.id)).ok}
      />
    </>
  )
}
