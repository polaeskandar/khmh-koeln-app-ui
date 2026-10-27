"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Eye,
  EyeOff,
  ListChecks,
  Pencil,
  Send,
  Trash2,
} from "lucide-react"
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
import type { HomeworkStatus } from "@/lib/domain/types"
import {
  archiveHomeworkAction,
  deleteHomeworkAction,
  publishHomeworkAction,
  restoreHomeworkAction,
  unpublishHomeworkAction,
} from "@/server/actions/learning"
import { isolate } from "@/lib/bidi"

export type HomeworkActionTarget = {
  id: string
  title: string
  status: HomeworkStatus
  publishedAt: string | null
  /** Completions parents reported and did not undo. */
  completed: number
}

/** Publish a draft in one step: parents of the class see it straight away. */
export function PublishHomeworkButton({
  hw,
  size = "default",
}: {
  hw: HomeworkActionTarget
  size?: "default" | "sm"
}) {
  const t = useTranslations("homework.actions")
  const publish = useServerAction(publishHomeworkAction)
  if (hw.status !== "draft") return null
  return (
    <Button size={size} disabled={publish.pending} onClick={() => publish.execute(hw.id)}>
      {publish.pending ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
      {t("publish")}
    </Button>
  )
}

/** Everything else a servant can do with a homework task, from a list row or its page. */
export function HomeworkActionsMenu({
  hw,
  stageBase,
  afterDelete,
  showProgress = true,
}: {
  hw: HomeworkActionTarget
  stageBase: string
  afterDelete?: string
  showProgress?: boolean
}) {
  const t = useTranslations("homework.actions")
  const tc = useTranslations("common")
  const router = useRouter()
  const [dialog, setDialog] = useState<"unpublish" | "archive" | "restore" | "delete" | null>(null)
  const publish = useServerAction(publishHomeworkAction)
  const unpublish = useServerAction(unpublishHomeworkAction)
  const archive = useServerAction(archiveHomeworkAction)
  const restore = useServerAction(restoreHomeworkAction)
  const remove = useServerAction(deleteHomeworkAction, {
    onSuccess: () => afterDelete && router.push(afterDelete),
  })
  const open = (d: typeof dialog) => (next: boolean) => setDialog(next ? d : null)
  const withProgress = showProgress && hw.status !== "draft"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={tc("actionsFor", { name: hw.title })}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {withProgress ? (
            <DropdownMenuItem asChild>
              <Link href={`${stageBase}/homework/${hw.id}`}>
                <ListChecks />
                {t("progress")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {hw.status !== "archived" ? (
            <DropdownMenuItem asChild>
              <Link href={`${stageBase}/homework/${hw.id}/edit`}>
                <Pencil />
                {tc("edit")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {hw.status === "draft" ? (
            <DropdownMenuItem onSelect={() => publish.execute(hw.id)}>
              <Eye />
              {t("publishToParents")}
            </DropdownMenuItem>
          ) : null}
          {hw.status === "published" && hw.completed === 0 ? (
            <DropdownMenuItem onSelect={() => setDialog("unpublish")}>
              <EyeOff />
              {t("unpublish")}
            </DropdownMenuItem>
          ) : null}
          {hw.status !== "archived" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog("archive")}>
                <Archive />
                {tc("archive")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {withProgress ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setDialog("restore")}>
                <ArchiveRestore />
                {tc("restore")}
              </DropdownMenuItem>
            </>
          )}
          {hw.publishedAt === null ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 />
              {t("deleteDraft")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "unpublish"}
        onOpenChange={open("unpublish")}
        title={t("unpublishTitle", { title: isolate(hw.title) })}
        description={t("unpublishText")}
        confirmLabel={t("unpublish")}
        onConfirm={async () => (await unpublish.execute(hw.id)).ok}
      />
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={open("archive")}
        title={t("archiveTitle", { title: isolate(hw.title) })}
        description={t("archiveText")}
        consequences={hw.completed > 0 ? [t("archiveKept", { count: hw.completed })] : undefined}
        confirmLabel={tc("archive")}
        onConfirm={async () => (await archive.execute(hw.id)).ok}
      />
      {/* Restoring brings back what the task was before: published (parents see it again) or a draft. */}
      <ConfirmDialog
        open={dialog === "restore"}
        onOpenChange={open("restore")}
        title={t("restoreTitle", { title: isolate(hw.title) })}
        description={hw.publishedAt !== null ? t("restorePublished") : t("restoreDraft")}
        confirmLabel={tc("restore")}
        onConfirm={async () => (await restore.execute(hw.id)).ok}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={open("delete")}
        title={t("deleteTitle", { title: isolate(hw.title) })}
        description={t("deleteText")}
        tone="destructive"
        confirmLabel={t("deleteDraft")}
        onConfirm={async () => (await remove.execute(hw.id)).ok}
      />
    </>
  )
}
