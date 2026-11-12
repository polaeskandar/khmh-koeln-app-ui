"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Shuffle,
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useServerAction } from "@/hooks/use-server-action"
import type { ServiceStructure } from "@/lib/domain/types"
import type { ActionResult } from "@/server/errors"
import {
  addStageAction,
  changeStructureAction,
  deleteServiceAction,
  moveStageAction,
  setServiceArchivedAction,
  setStageArchivedAction,
  updateServiceAction,
  updateStageAction,
} from "@/server/actions/services"

import { StructureChoice } from "./new-service-dialog"

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  submitLabel,
  onSubmit,
  nameLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initial: { name: string; description: string | null }
  submitLabel: string
  nameLabel: string
  onSubmit: (value: { name: string; description: string | null }) => Promise<ActionResult<unknown>>
}) {
  const tc = useTranslations("common")
  const t = useTranslations("services.create")
  const [name, setName] = useState(initial.name)
  const [text, setText] = useState(initial.description ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)

        if (next) {
          setName(initial.name)
          setText(initial.description ?? "")
          setErrors({})
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault()
            setPending(true)
            const result = await onSubmit({ name, description: text.trim() || null })
            setPending(false)

            if (result.ok) {
              onOpenChange(false)
            } else {
              setErrors(result.problem.fieldErrors ?? {})
            }
          }}
        >
          <TextField
            label={nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoFocus
          />
          <TextAreaField
            label={t("descriptionLabel")}
            optional
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.description}
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

function useToastAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>) {
  return useServerAction(action).execute
}

export function ServiceActions({
  service,
}: {
  service: {
    id: string
    name: string
    description: string | null
    structure: ServiceStructure
    archived: boolean
    hasHistory: boolean
  }
}) {
  const t = useTranslations("services.actions")
  const tc = useTranslations("common")
  const router = useRouter()
  const [dialog, setDialog] = useState<"edit" | "structure" | "archive" | "delete" | null>(null)
  const [structure, setStructure] = useState<ServiceStructure>(
    service.structure === "stages" ? "single" : "stages"
  )
  const [firstStage, setFirstStage] = useState("")
  const updateService = useToastAction(updateServiceAction)
  const archive = useToastAction(setServiceArchivedAction)
  const remove = useToastAction(deleteServiceAction)
  const change = useServerAction(changeStructureAction)

  return (
    <>
      <Button variant="outline" onClick={() => setDialog("edit")}>
        <Pencil data-icon="inline-start" />
        {tc("edit")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={tc("moreActionsFor", { name: service.name })}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem disabled={service.hasHistory} onSelect={() => setDialog("structure")}>
            <Shuffle />
            {t("changeStructure")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("archive")}>
            {service.archived ? <ArchiveRestore /> : <Archive />}
            {service.archived ? tc("restore") : tc("archive")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={service.hasHistory}
            onSelect={() => setDialog("delete")}
          >
            <Trash2 />
            {tc("delete")}
          </DropdownMenuItem>
          {service.hasHistory ? (
            <p className="px-2 py-1.5 text-xs text-pretty text-muted-foreground">
              {t("lockedHint")}
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title={t("editTitle")}
        nameLabel={t("name")}
        initial={service}
        submitLabel={tc("saveChanges")}
        onSubmit={(value) => updateService(service.id, value)}
      />
      <Dialog
        open={dialog === "structure"}
        onOpenChange={(open) => setDialog(open ? "structure" : null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("changeStructure")}</DialogTitle>
            <DialogDescription>{t("structureHint")}</DialogDescription>
          </DialogHeader>
          <StructureChoice value={structure} onChange={setStructure} />
          {structure === "stages" && service.structure === "single" ? (
            <TextField
              label={t("firstStage")}
              value={firstStage}
              onChange={(e) => setFirstStage(e.target.value)}
              error={change.fieldErrors.stage ?? change.fieldErrors["stages.0"]}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={change.pending || structure === service.structure}
              onClick={async () => {
                const result = await change.execute(
                  service.id,
                  structure,
                  structure === "stages" ? { name: firstStage, description: null } : null
                )

                if (result.ok) {
                  setDialog(null)
                }
              }}
            >
              {t("applyStructure")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => setDialog(open ? "archive" : null)}
        title={
          service.archived
            ? t("restoreTitle", { name: service.name })
            : t("archiveTitle", { name: service.name })
        }
        description={service.archived ? t("restoreHint") : t("archiveHint")}
        confirmLabel={service.archived ? tc("restore") : tc("archive")}
        onConfirm={async () => (await archive(service.id, !service.archived)).ok}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        tone="destructive"
        title={t("deleteTitle", { name: service.name })}
        description={t("deleteHint")}
        confirmLabel={tc("delete")}
        onConfirm={async () => {
          const result = await remove(service.id)

          if (result.ok) {
            router.push("/services")
          }

          return result.ok
        }}
      />
    </>
  )
}

export function AddStageButton({ serviceId }: { serviceId: string }) {
  const t = useTranslations("stages")
  const [open, setOpen] = useState(false)
  const add = useToastAction(addStageAction)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {t("add")}
      </Button>
      <NameDialog
        open={open}
        onOpenChange={setOpen}
        title={t("addTitle")}
        nameLabel={t("name")}
        initial={{ name: "", description: null }}
        submitLabel={t("add")}
        onSubmit={(value) => add(serviceId, value)}
      />
    </>
  )
}

export function StageActions({
  stage,
  first,
  last,
}: {
  stage: { id: string; name: string; description: string | null; archived: boolean }
  first: boolean
  last: boolean
}) {
  const t = useTranslations("stages")
  const tc = useTranslations("common")
  const [dialog, setDialog] = useState<"edit" | "archive" | null>(null)
  const update = useToastAction(updateStageAction)
  const archive = useToastAction(setStageArchivedAction)
  const move = useServerAction(moveStageAction, { toastOnSuccess: false })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tc("moreActionsFor", { name: stage.name })}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil />
            {tc("edit")}
          </DropdownMenuItem>
          {stage.archived ? null : (
            <>
              <DropdownMenuItem disabled={first} onSelect={() => move.execute(stage.id, -1)}>
                <ArrowUp />
                {t("moveUp")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onSelect={() => move.execute(stage.id, 1)}>
                <ArrowDown />
                {t("moveDown")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("archive")}>
            {stage.archived ? <ArchiveRestore /> : <Archive />}
            {stage.archived ? tc("restore") : tc("archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title={t("editTitle")}
        nameLabel={t("name")}
        initial={stage}
        submitLabel={tc("saveChanges")}
        onSubmit={(value) => update(stage.id, value)}
      />
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => setDialog(open ? "archive" : null)}
        title={
          stage.archived
            ? t("restoreTitle", { name: stage.name })
            : t("archiveTitle", { name: stage.name })
        }
        description={stage.archived ? t("restoreHint") : t("archiveHint")}
        confirmLabel={stage.archived ? tc("restore") : tc("archive")}
        onConfirm={async () => (await archive(stage.id, !stage.archived)).ok}
      />
    </>
  )
}
