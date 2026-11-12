"use client"

import { useRouter } from "next/navigation"
import { CheckCircle2, EyeOff, Megaphone, Trash2, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import type { LessonStatus } from "@/lib/domain/types"
import { deleteLessonAction, setLessonStatusAction } from "@/server/actions/learning"

export function LessonStatusActions({
  lessonId,
  status,
  canPrepare,
  canPublish,
  hasTasks,
}: {
  lessonId: string
  status: LessonStatus
  canPrepare: boolean
  canPublish: boolean
  hasTasks: boolean
}) {
  const t = useTranslations("lessons.actions")
  const router = useRouter()
  const setStatus = useServerAction(setLessonStatusAction)
  const remove = useServerAction(deleteLessonAction, { onSuccess: () => router.push("/lessons") })

  return (
    <div className="flex flex-col gap-2">
      {status === "draft" && canPrepare ? (
        <Button
          variant="outline"
          onClick={() => setStatus.execute(lessonId, "ready")}
          disabled={setStatus.pending}
        >
          <CheckCircle2 data-icon="inline-start" />
          {t("markReady")}
        </Button>
      ) : null}
      {status !== "published" && canPublish ? (
        <ConfirmDialog
          trigger={
            <Button>
              <Megaphone data-icon="inline-start" />
              {t("publish")}
            </Button>
          }
          title={t("publishTitle")}
          description={t("publishHint")}
          consequences={[t("publishShows"), t("publishHides")]}
          confirmLabel={t("publish")}
          onConfirm={async () => (await setStatus.execute(lessonId, "published")).ok}
        />
      ) : null}
      {status === "published" && canPublish ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <EyeOff data-icon="inline-start" />
              {t("unpublish")}
            </Button>
          }
          title={t("unpublishTitle")}
          description={t("unpublishHint")}
          confirmLabel={t("unpublish")}
          onConfirm={async () => (await setStatus.execute(lessonId, "ready")).ok}
        />
      ) : null}
      {status === "ready" && canPrepare ? (
        <Button
          variant="ghost"
          onClick={() => setStatus.execute(lessonId, "draft")}
          disabled={setStatus.pending}
        >
          <Undo2 data-icon="inline-start" />
          {t("backToDraft")}
        </Button>
      ) : null}
      {status !== "published" && canPrepare && !hasTasks ? (
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
          onConfirm={async () => (await remove.execute(lessonId)).ok}
        />
      ) : null}
    </div>
  )
}
