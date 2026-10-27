"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  CircleCheck,
  Ellipsis,
  Pencil,
  PencilLine,
  Trash2,
  Undo2,
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
import type { LessonStatus, LocalDate } from "@/lib/domain/types"
import {
  archiveLessonAction,
  deleteLessonAction,
  restoreLessonAction,
  setLessonStatusAction,
} from "@/server/actions/learning"
import { isolate } from "@/lib/bidi"

/**
 * The lesson's status steps: Draft → Ready (preparation done) → Completed
 * (taught). "Completed" is offered only from the teaching date on.
 */
export function LessonActions({
  lesson,
  today,
  base,
  publishedHomework,
}: {
  lesson: {
    id: string
    title: string
    status: LessonStatus
    archived: boolean
    teachingDate: LocalDate
  }
  today: LocalDate
  /** The stage's lessons URL. */
  base: string
  publishedHomework: number
}) {
  const t = useTranslations("lessons.actions")
  const tc = useTranslations("common")
  const router = useRouter()
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null)
  const status = useServerAction(setLessonStatusAction)
  const archive = useServerAction(archiveLessonAction)
  const restore = useServerAction(restoreLessonAction)
  const remove = useServerAction(deleteLessonAction, { onSuccess: () => router.push(base) })
  const taughtYet = lesson.teachingDate <= today

  if (lesson.archived) {
    return (
      <Button
        variant="outline"
        disabled={restore.pending}
        onClick={() => restore.execute(lesson.id)}
      >
        {restore.pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <ArchiveRestore data-icon="inline-start" />
        )}
        {tc("restore")}
      </Button>
    )
  }

  return (
    <>
      <Button variant="outline" asChild>
        <Link href={`${base}/${lesson.id}/edit`}>
          <Pencil data-icon="inline-start" />
          {tc("edit")}
        </Link>
      </Button>
      {lesson.status === "draft" ? (
        <Button disabled={status.pending} onClick={() => status.execute(lesson.id, "ready")}>
          {status.pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CircleCheck data-icon="inline-start" />
          )}
          {t("markReady")}
        </Button>
      ) : lesson.status === "ready" && taughtYet ? (
        <Button disabled={status.pending} onClick={() => status.execute(lesson.id, "completed")}>
          {status.pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CheckCheck data-icon="inline-start" />
          )}
          {t("markTaught")}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={tc("moreActions")}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {lesson.status === "ready" ? (
            <DropdownMenuItem onSelect={() => status.execute(lesson.id, "draft")}>
              <PencilLine />
              {t("backToDraft")}
            </DropdownMenuItem>
          ) : null}
          {lesson.status === "completed" ? (
            <DropdownMenuItem onSelect={() => status.execute(lesson.id, "ready")}>
              <Undo2 />
              {t("notTaughtYet")}
            </DropdownMenuItem>
          ) : null}
          {lesson.status !== "draft" ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => setDialog("archive")}>
            <Archive />
            {tc("archive")}
          </DropdownMenuItem>
          {lesson.status === "draft" && publishedHomework === 0 ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 />
              {t("deleteDraft")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => setDialog(open ? "archive" : null)}
        title={t("archiveTitle", { title: isolate(lesson.title) })}
        description={t("archiveDescription")}
        consequences={
          publishedHomework > 0
            ? [t("archiveHomework", { count: publishedHomework }), t("archiveKept")]
            : undefined
        }
        confirmLabel={tc("archive")}
        onConfirm={async () => (await archive.execute(lesson.id)).ok}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={t("deleteTitle", { title: isolate(lesson.title) })}
        description={t("deleteDescription")}
        tone="destructive"
        confirmLabel={t("deleteDraft")}
        onConfirm={async () => (await remove.execute(lesson.id)).ok}
      />
    </>
  )
}
