"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Megaphone, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import type { TaskStatus } from "@/lib/domain/types"
import { deleteTaskAction, setTaskStatusAction } from "@/server/actions/learning"

export function TaskActions({
  taskId,
  status,
  canUpdate,
  canDelete,
}: {
  taskId: string
  status: TaskStatus
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("tasks.actions")
  const router = useRouter()
  const setStatus = useServerAction(setTaskStatusAction)
  const remove = useServerAction(deleteTaskAction, {
    onSuccess: () => router.push("/lessons/tasks"),
  })

  if (!canUpdate) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/lessons/tasks/${taskId}/edit`}>
          <Pencil data-icon="inline-start" />
          {t("edit")}
        </Link>
      </Button>
      {status === "draft" ? (
        <>
          <Button
            onClick={() => setStatus.execute(taskId, "published")}
            disabled={setStatus.pending}
          >
            <Megaphone data-icon="inline-start" />
            {t("publish")}
          </Button>
          {canDelete ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive">
                  <Trash2 data-icon="inline-start" />
                  {t("delete")}
                </Button>
              }
              title={t("deleteTitle")}
              description={t("deleteHint")}
              confirmLabel={t("delete")}
              tone="destructive"
              onConfirm={async () => (await remove.execute(taskId)).ok}
            />
          ) : null}
        </>
      ) : null}
      {status === "published" ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <Archive data-icon="inline-start" />
              {t("archive")}
            </Button>
          }
          title={t("archiveTitle")}
          description={t("archiveHint")}
          confirmLabel={t("archive")}
          onConfirm={async () => (await setStatus.execute(taskId, "archived")).ok}
        />
      ) : null}
      {status === "archived" ? (
        <Button
          variant="outline"
          onClick={() => setStatus.execute(taskId, "published")}
          disabled={setStatus.pending}
        >
          <ArchiveRestore data-icon="inline-start" />
          {t("restore")}
        </Button>
      ) : null}
    </div>
  )
}
