"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { FormPanel } from "@/components/form-panel"
import { TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import type { Lesson, Material, Unit } from "@/lib/domain/types"
import { createLessonAction, updateLessonAction } from "@/server/actions/learning"

export function LinkRows<T extends { label: string; url: string | null; shared?: boolean }>({
  rows,
  onChange,
  errors,
  field,
  blank,
  withShared,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  errors: Record<string, string>
  field: string
  blank: T
  withShared?: boolean
}) {
  const t = useTranslations("lessons.editor")

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-col gap-2 border p-3">
          <div className="flex gap-2">
            <Input
              aria-label={t("linkLabel", { position: index + 1 })}
              placeholder={t("linkLabelPlaceholder")}
              value={row.label}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeLink", { position: index + 1 })}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
          <Input
            aria-label={t("linkUrl", { position: index + 1 })}
            placeholder="https://"
            dir="ltr"
            value={row.url ?? ""}
            onChange={(e) =>
              onChange(
                rows.map((r, i) => (i === index ? { ...r, url: e.target.value || null } : r))
              )
            }
          />
          {withShared ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={row.shared === true}
                onCheckedChange={(checked) =>
                  onChange(
                    rows.map((r, i) => (i === index ? { ...r, shared: checked === true } : r))
                  )
                }
              />
              {row.shared ? (
                <Eye className="size-4 text-success" aria-hidden="true" />
              ) : (
                <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              {t("shareMaterial")}
            </label>
          ) : null}
          {errors[`${field}.${index}`] ? (
            <FieldError>{errors[`${field}.${index}`]}</FieldError>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => onChange([...rows, { ...blank }])}
      >
        <Plus data-icon="inline-start" />
        {t("addLink")}
      </Button>
    </div>
  )
}

export function LessonEditor({
  unit,
  lesson,
  sessions,
}: {
  unit: Unit
  lesson: Lesson | null
  sessions: { id: string; date: string; startTime: string }[]
}) {
  const t = useTranslations("lessons.editor")
  const tc = useTranslations("common")
  const f = useFormat()
  const router = useRouter()
  const id = useId()
  const [value, setValue] = useState({
    sessionId: (lesson?.sessionId ?? sessions[0]?.id ?? null) as string | null,
    title: lesson?.title ?? "",
    summary: lesson?.summary ?? "",
    objectives: lesson?.objectives ?? "",
    teachingPoints: lesson?.teachingPoints ?? "",
    notes: lesson?.notes ?? "",
    materials: lesson?.materials ?? ([] as Material[]),
  })
  const create = useServerAction(createLessonAction, {
    onSuccess: (lessonId) => router.push(`/lessons/${lessonId}`),
  })
  const update = useServerAction(updateLessonAction, {
    onSuccess: (lessonId) => router.push(`/lessons/${lessonId}`),
  })
  const errors = { ...create.fieldErrors, ...update.fieldErrors }
  const pending = create.pending || update.pending
  const set = (patch: Partial<typeof value>) => setValue({ ...value, ...patch })

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      onSubmit={(e) => {
        e.preventDefault()
        const input = {
          sessionId: value.sessionId,
          date: lesson && !value.sessionId ? lesson.date : null,
          title: value.title,
          summary: value.summary || null,
          objectives: value.objectives || null,
          teachingPoints: value.teachingPoints || null,
          notes: value.notes || null,
          materials: value.materials,
        }

        void (lesson ? update.execute(lesson.id, input) : create.execute(unit, input))
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <FormPanel title={t("overview")} note={<VisibleNote />}>
          <TextField
            label={t("title")}
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            error={errors.title}
          />
          <TextAreaField
            label={t("summary")}
            description={t("summaryHint")}
            rows={3}
            value={value.summary}
            onChange={(e) => set({ summary: e.target.value })}
            error={errors.summary}
          />
        </FormPanel>
        <FormPanel title={t("teachingPlan")} note={<VisibleNote />}>
          <TextAreaField
            label={t("objectives")}
            description={t("onePerLine")}
            rows={3}
            value={value.objectives}
            onChange={(e) => set({ objectives: e.target.value })}
            error={errors.objectives}
          />
          <TextAreaField
            label={t("teachingPoints")}
            description={t("onePerLine")}
            rows={5}
            value={value.teachingPoints}
            onChange={(e) => set({ teachingPoints: e.target.value })}
            error={errors.teachingPoints}
          />
        </FormPanel>
        <FormPanel
          title={t("preparation")}
          note={<span className="text-xs text-muted-foreground">{t("preparationNote")}</span>}
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("materials")}</span>
            <LinkRows
              rows={value.materials}
              onChange={(materials) => set({ materials })}
              errors={errors}
              field="materials"
              blank={{ label: "", url: null, shared: false }}
              withShared
            />
          </div>
          <TextAreaField
            label={t("notes")}
            description={t("notesHint")}
            rows={3}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            error={errors.notes}
          />
        </FormPanel>
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <FormPanel title={t("when")}>
          <Field data-invalid={errors.sessionId ? true : undefined}>
            <FieldLabel htmlFor={id}>{t("session")}</FieldLabel>
            <NativeSelect
              id={id}
              className="w-full"
              value={value.sessionId ?? ""}
              onChange={(e) => set({ sessionId: e.target.value || null })}
            >
              {lesson && !value.sessionId ? (
                <NativeSelectOption value="">{f.mediumDate(lesson.date)}</NativeSelectOption>
              ) : null}
              {sessions.map((x) => (
                <NativeSelectOption key={x.id} value={x.id}>
                  {f.mediumDate(x.date)} · {x.startTime}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {errors.sessionId ? <FieldError>{errors.sessionId}</FieldError> : null}
          </Field>
        </FormPanel>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {lesson ? tc("saveChanges") : t("create")}
          </Button>
        </div>
        <p className="text-xs text-pretty text-muted-foreground">{t("draftHint")}</p>
      </div>
    </form>
  )
}

function VisibleNote() {
  const t = useTranslations("lessons.editor")

  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Eye className="size-3.5" aria-hidden="true" />
      {t("visibleOnPublish")}
    </span>
  )
}
