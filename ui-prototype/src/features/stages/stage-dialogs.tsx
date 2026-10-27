"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Ellipsis,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import {
  archiveStageAction,
  createStageAction,
  deleteStageAction,
  restoreStageAction,
  updateStageAction,
} from "@/server/actions/services"

type StageFields = { id: string; name: string; description: string | null }

/** Create or edit a stage. Names are unique within the service. */
export function StageFormDialog({
  serviceId,
  serviceName,
  stage,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  serviceId: string
  serviceName: string
  stage?: StageFields
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const t = useTranslations("stages.form")
  const tc = useTranslations("common")
  const router = useRouter()
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen
  const [name, setName] = useState(stage?.name ?? "")
  const [description, setDescription] = useState(stage?.description ?? "")
  const create = useServerAction(createStageAction, {
    onSuccess: (r) => {
      setOpen(false)
      router.push(`/services/${serviceId}/stages/${r.id}`)
    },
  })
  const update = useServerAction(updateStageAction, { onSuccess: () => setOpen(false) })
  const action = stage ? update : create
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName(stage?.name ?? "")
          setDescription(stage?.description ?? "")
          create.reset()
          update.reset()
        }
        setOpen(next)
      }}
    >
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus data-icon="inline-start" />
            {t("add")}
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
            if (stage) update.execute(stage.id, { name, description })
            else create.execute(serviceId, { name, description })
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {stage
                ? t("editTitle", { name: stage.name })
                : t("addTitle", { service: serviceName })}
            </DialogTitle>
            <DialogDescription>
              {stage ? t("editDescription") : t("addDescription")}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <TextField
              label={t("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              autoFocus
              placeholder={t("namePlaceholder")}
              error={action.fieldErrors.name}
            />
            <TextAreaField
              label={t("description")}
              optional
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t("descriptionPlaceholder")}
              error={action.fieldErrors.description}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? <Spinner data-icon="inline-start" /> : null}
              {stage ? tc("saveChanges") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function StageActionsMenu({
  serviceId,
  serviceName,
  stage,
  archived,
  members,
  sessions,
  deleteBlocker,
  onMove,
  canMoveUp,
  canMoveDown,
  afterDelete,
  variant = "icon",
}: {
  serviceId: string
  serviceName: string
  stage: StageFields
  archived: boolean
  members: number
  sessions: number
  deleteBlocker: string | null
  onMove?: (direction: -1 | 1) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  afterDelete?: string
  variant?: "icon" | "button"
}) {
  const t = useTranslations("stages")
  const tc = useTranslations("common")
  const router = useRouter()
  const [dialog, setDialog] = useState<null | "edit" | "archive" | "restore" | "delete">(null)
  const archive = useServerAction(archiveStageAction)
  const restore = useServerAction(restoreStageAction)
  const remove = useServerAction(deleteStageAction, {
    onSuccess: () => {
      if (afterDelete) router.push(afterDelete)
    },
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("actionsFor", { name: stage.name })}
            >
              <Ellipsis />
            </Button>
          ) : (
            <Button variant="outline">
              <Ellipsis data-icon="inline-start" />
              {tc("more")}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil />
            {t("actions.rename")}
          </DropdownMenuItem>
          {onMove && !archived ? (
            <>
              <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}>
                <ArrowUp />
                {t("actions.moveUp")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}>
                <ArrowDown />
                {t("actions.moveDown")}
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
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
          {deleteBlocker ? (
            <>
              <DropdownMenuItem disabled>
                <Trash2 />
                {tc("delete")}
              </DropdownMenuItem>
              <DropdownMenuLabel className="pt-0 text-xs font-normal text-muted-foreground">
                {deleteBlocker}.
              </DropdownMenuLabel>
            </>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 />
              {tc("delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <StageFormDialog
        serviceId={serviceId}
        serviceName={serviceName}
        stage={stage}
        trigger={null}
        open={dialog === "edit"}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
      />
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(o) => setDialog(o ? "archive" : null)}
        title={t("archive.title", { name: stage.name })}
        description={t("archive.description", { service: serviceName })}
        consequences={[
          t("archive.schedules"),
          members > 0 ? t("archive.members", { count: members }) : null,
          sessions > 0 ? t("archive.sessions", { count: sessions }) : null,
        ].filter(Boolean)}
        confirmLabel={tc("archive")}
        onConfirm={async () => (await archive.execute(stage.id)).ok}
      />
      <ConfirmDialog
        open={dialog === "restore"}
        onOpenChange={(o) => setDialog(o ? "restore" : null)}
        title={t("restore.title", { name: stage.name })}
        description={t("restore.description")}
        confirmLabel={tc("restore")}
        onConfirm={async () => (await restore.execute(stage.id)).ok}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={t("delete.title", { name: stage.name })}
        description={t("delete.description")}
        tone="destructive"
        consequences={[t("delete.schedules"), t("delete.cantUndo")]}
        confirmLabel={tc("delete")}
        onConfirm={async () => (await remove.execute(stage.id)).ok}
      />
    </>
  )
}
