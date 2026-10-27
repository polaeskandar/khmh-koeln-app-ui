"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  archiveServiceAction,
  createServiceAction,
  deleteServiceAction,
  restoreServiceAction,
  updateServiceAction,
} from "@/server/actions/services"

type ServiceFields = { id: string; name: string; description: string | null }

/** Create or edit a service: a name (unique, case-insensitive) and an optional description. */
export function ServiceFormDialog({
  service,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  service?: ServiceFields
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const t = useTranslations("services")
  const tc = useTranslations("common")
  const router = useRouter()
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen
  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const create = useServerAction(createServiceAction, {
    onSuccess: (r) => {
      setOpen(false)
      router.push(`/services/${r.id}`)
    },
  })
  const update = useServerAction(updateServiceAction, { onSuccess: () => setOpen(false) })
  const action = service ? update : create
  const reset = () => {
    setName(service?.name ?? "")
    setDescription(service?.description ?? "")
    create.reset()
    update.reset()
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
    >
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" />
            {t("new")}
          </Button>
        </DialogTrigger>
      ) : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (service) update.execute(service.id, { name, description })
            else create.execute({ name, description })
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {service ? t("form.editTitle", { name: service.name }) : t("new")}
            </DialogTitle>
            <DialogDescription>
              {service ? t("form.editDescription") : t("form.newDescription")}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <TextField
              label={t("form.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus
              placeholder={t("form.namePlaceholder")}
              error={action.fieldErrors.name}
            />
            <TextAreaField
              label={t("form.description")}
              optional
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder={t("form.descriptionPlaceholder")}
              error={action.fieldErrors.description}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? <Spinner data-icon="inline-start" /> : null}
              {service ? tc("saveChanges") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type ServiceImpact = {
  sessions: number
  activeSessions: number
  upcomingSessions: number
  stages: number
  schedules: number
  activeSchedules: number
  members: number
}

/**
 * Edit, archive, restore and delete. Delete is offered only while the service
 * has no meeting history; after that it can only be archived.
 */
export function ServiceActionsMenu({
  service,
  archived,
  impact,
  can,
  afterDelete,
  variant = "icon",
}: {
  service: ServiceFields
  archived: boolean
  impact: ServiceImpact
  can: { edit: boolean; archive: boolean }
  afterDelete?: string
  variant?: "icon" | "button"
}) {
  const t = useTranslations("services")
  const tc = useTranslations("common")
  const router = useRouter()
  const [dialog, setDialog] = useState<null | "edit" | "archive" | "restore" | "delete">(null)
  const archive = useServerAction(archiveServiceAction)
  const restore = useServerAction(restoreServiceAction)
  const remove = useServerAction(deleteServiceAction, {
    onSuccess: () => {
      if (afterDelete) router.push(afterDelete)
    },
  })
  if (!can.edit && !can.archive) return null
  const deletable = impact.sessions === 0
  const removes =
    impact.stages && impact.schedules
      ? t("delete.removesAll", { stages: impact.stages, schedules: impact.schedules })
      : impact.stages
        ? t("delete.removesStages", { stages: impact.stages })
        : impact.schedules
          ? t("delete.removesSchedules", { schedules: impact.schedules })
          : t("delete.removes")
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("actionsFor", { name: service.name })}
            >
              <Ellipsis />
            </Button>
          ) : (
            <Button variant="outline" aria-label={tc("moreActionsFor", { name: service.name })}>
              <Ellipsis data-icon="inline-start" />
              {tc("more")}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {can.edit ? (
            <DropdownMenuItem onSelect={() => setDialog("edit")}>
              <Pencil />
              {t("actions.editDetails")}
            </DropdownMenuItem>
          ) : null}
          {can.archive ? (
            <>
              {archived ? (
                <DropdownMenuItem onSelect={() => setDialog("restore")}>
                  <ArchiveRestore />
                  {tc("restore")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog("archive")}>
                  <Archive />
                  {tc("archive")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {deletable ? (
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                  <Trash2 />
                  {tc("delete")}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem disabled>
                    <Trash2 />
                    {tc("delete")}
                  </DropdownMenuItem>
                  <p className="ps-9.5 pe-3 pb-2 text-xs text-muted-foreground">
                    {t("actions.deleteBlocked", { count: impact.sessions })}
                  </p>
                </>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ServiceFormDialog
        service={service}
        trigger={null}
        open={dialog === "edit"}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
      />

      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(o) => setDialog(o ? "archive" : null)}
        title={t("archive.title", { name: service.name })}
        description={t("archive.description")}
        consequences={[
          impact.activeSchedules > 0
            ? t("archive.schedules", { count: impact.activeSchedules })
            : t("archive.noSchedules"),
          impact.upcomingSessions > 0
            ? t("archive.upcoming", { count: impact.upcomingSessions })
            : null,
          t("archive.kept"),
        ].filter(Boolean)}
        note={impact.activeSessions > 0 ? t("archive.note") : undefined}
        confirmLabel={tc("archive")}
        onConfirm={async () => (await archive.execute(service.id)).ok}
      />

      <ConfirmDialog
        open={dialog === "restore"}
        onOpenChange={(o) => setDialog(o ? "restore" : null)}
        title={t("restore.title", { name: service.name })}
        description={t("restore.description")}
        confirmLabel={tc("restore")}
        onConfirm={async () => (await restore.execute(service.id)).ok}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={t("delete.title", { name: service.name })}
        description={t("delete.description")}
        tone="destructive"
        consequences={[
          removes,
          impact.members > 0 ? t("delete.members", { count: impact.members }) : null,
          t("delete.cantUndo"),
        ].filter(Boolean)}
        confirmLabel={tc("delete")}
        onConfirm={async () => (await remove.execute(service.id)).ok}
      />
    </>
  )
}
