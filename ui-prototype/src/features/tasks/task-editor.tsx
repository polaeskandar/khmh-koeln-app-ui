"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Megaphone } from "lucide-react"
import { useTranslations } from "next-intl"

import { FormPanel } from "@/components/form-panel"
import { OptionalInput, TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { LinkRows } from "@/features/lessons/lesson-editor"
import { useServerAction } from "@/hooks/use-server-action"
import type { Resource, Task } from "@/lib/domain/types"
import { createTaskAction, updateTaskAction } from "@/server/actions/learning"

export function TaskEditor({
  lessonId,
  task,
  defaultDue,
}: {
  lessonId: string
  task: Task | null
  defaultDue: string | null
}) {
  const t = useTranslations("tasks.editor")
  const tc = useTranslations("common")
  const router = useRouter()
  const [title, setTitle] = useState(task?.title ?? "")
  const [instructions, setInstructions] = useState(task?.instructions ?? "")
  const [dueDate, setDueDate] = useState(task ? (task.dueDate ?? "") : (defaultDue ?? ""))
  const [resources, setResources] = useState<Resource[]>(task?.resources ?? [])
  const done = (id: string) => router.push(`/lessons/tasks/${id}`)
  const create = useServerAction(createTaskAction, { onSuccess: done })
  const update = useServerAction(updateTaskAction, { onSuccess: done })
  const errors = { ...create.fieldErrors, ...update.fieldErrors }
  const pending = create.pending || update.pending
  const input = () => ({ title, instructions, dueDate: dueDate || null, resources })

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void (task ? update.execute(task.id, input()) : create.execute(lessonId, input(), false))
      }}
    >
      <FormPanel title={t("task")}>
        <TextField
          label={t("title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <TextAreaField
          label={t("instructions")}
          description={t("instructionsHint")}
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          error={errors.instructions}
        />
        <div className="max-w-64">
          <OptionalInput
            type="date"
            label={t("dueDate")}
            value={dueDate || null}
            onChange={(value) => setDueDate(value ?? "")}
            error={errors.dueDate}
          />
        </div>
      </FormPanel>
      <FormPanel title={t("resources")} optional>
        <LinkRows
          rows={resources}
          onChange={setResources}
          errors={errors}
          field="resources"
          blank={{ label: "", url: null }}
        />
      </FormPanel>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" variant={task ? "default" : "outline"} disabled={pending}>
          {task ? tc("saveChanges") : t("saveDraft")}
        </Button>
        {task ? null : (
          <Button
            type="button"
            disabled={pending}
            onClick={() => create.execute(lessonId, input(), true)}
          >
            <Megaphone data-icon="inline-start" />
            {t("publish")}
          </Button>
        )}
      </div>
    </form>
  )
}
