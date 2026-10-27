"use client"

/**
 * Create or edit homework (S05), with a live preview of what parents will see.
 * Publishing is one explicit step; drafts never reach the parent portal.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Eye, Link2, Plus, Send, Smartphone, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { OptionalNote, TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { FormPanel } from "@/components/form-panel"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { addDays } from "@/lib/domain/time"
import type { Material } from "@/lib/domain/types"
import { createHomeworkAction, updateHomeworkAction } from "@/server/actions/learning"
import type { HomeworkEditor } from "@/server/queries/learning"

import { HomeworkStatusBadge } from "../lessons/lesson-bits"
import { ParentHomeworkView } from "../parent/homework-view"

type LessonOption = HomeworkEditor["lessons"][number]
type HomeworkT = ReturnType<typeof useTranslations<"homework">>

/** Starting points servants use most; they only fill in the form. */
function templates(t: HomeworkT, lesson: LessonOption | null) {
  // Memory verses are written "… (Luke 10:27)"; the reference is enough in the instructions.
  const ref = lesson?.memoryVerse?.match(/\(([^)]+)\)\s*$/)?.[1]
  return [
    {
      title: t("editor.templates.verse.title"),
      instructions: ref
        ? t("editor.templates.verse.textRef", { ref })
        : t("editor.templates.verse.text"),
    },
    {
      title: t("editor.templates.story.title"),
      instructions: lesson?.passage
        ? t("editor.templates.story.textPassage", { passage: lesson.passage })
        : t("editor.templates.story.text"),
    },
    {
      title: t("editor.templates.prayer.title"),
      instructions: t("editor.templates.prayer.text"),
    },
  ]
}

export function HomeworkEditorForm({
  editor,
  stageBase,
}: {
  editor: HomeworkEditor
  stageBase: string
}) {
  const t = useTranslations("homework")
  const tc = useTranslations("common")
  const tp = useTranslations("parent.completion")
  const f = useFormat()
  const router = useRouter()
  const hw = editor.homework
  const [lessonId, setLessonId] = useState(editor.lesson?.id ?? "")
  const lesson = editor.lessons.find((l) => l.id === lessonId) ?? null
  const [title, setTitle] = useState(hw?.title ?? "")
  const [instructions, setInstructions] = useState(hw?.instructions ?? "")
  const [dueDate, setDueDate] = useState(hw?.dueDate ?? "")
  const [resources, setResources] = useState<Material[]>(hw?.resources ?? [])
  const [intent, setIntent] = useState<"draft" | "publish" | null>(null)

  const done = () => router.push(`${stageBase}/lessons/${lessonId}`)
  const create = useServerAction(createHomeworkAction, { onSuccess: done })
  const update = useServerAction(updateHomeworkAction, { onSuccess: done })
  const action = hw ? update : create
  const errors = action.fieldErrors
  const pending = action.pending

  const input = () => ({
    title,
    instructions,
    dueDate: dueDate || null,
    resources: resources.filter((r) => r.label.trim() || (r.url ?? "").trim()),
  })
  const save = (publish: boolean) => {
    setIntent(publish ? "publish" : "draft")
    if (hw) update.execute(hw.id, input(), publish)
    else create.execute(lessonId, input(), publish)
  }

  const weekAfter = lesson ? addDays(lesson.teachingDate, 7) : null
  const published = hw?.status === "published"

  return (
    <form
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]"
      onSubmit={(e) => {
        e.preventDefault()
        save(published)
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <FormPanel title={t("editor.lesson")}>
          {hw ? (
            <p className="text-sm">
              <Link
                href={`${stageBase}/lessons/${lessonId}`}
                className="font-medium underline underline-offset-4"
              >
                {lesson?.title}
              </Link>{" "}
              <span className="text-muted-foreground">
                · {lesson ? f.relativeDay(lesson.teachingDate, editor.today) : ""}
              </span>
            </p>
          ) : (
            <Field>
              <FieldLabel htmlFor="hw-lesson">{t("editor.givenWith")}</FieldLabel>
              <NativeSelect
                id="hw-lesson"
                className="w-full"
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
              >
                {editor.lessons.map((l) => (
                  <NativeSelectOption key={l.id} value={l.id}>
                    {f.dayMonth(l.teachingDate)} · {l.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t("editor.lessonNote")}</FieldDescription>
            </Field>
          )}
        </FormPanel>

        <FormPanel title={t("editor.homework")}>
          {!hw ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("editor.startFrom")}</span>
              {templates(t, lesson).map((tpl) => (
                <Button
                  key={tpl.title}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setTitle(tpl.title)
                    setInstructions(tpl.instructions)
                  }}
                >
                  {tpl.title}
                </Button>
              ))}
            </div>
          ) : null}
          <FieldGroup>
            <TextField
              label={t("editor.titleLabel")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t("editor.titlePlaceholder")}
              error={errors.title}
            />
            <TextAreaField
              label={t("editor.instructionsLabel")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              required
              maxLength={2000}
              placeholder={t("editor.instructionsPlaceholder")}
              description={t("editor.instructionsHint")}
              error={errors.instructions}
              className="[&_textarea]:min-h-28"
            />
            <Field data-invalid={errors.dueDate ? true : undefined}>
              <FieldLabel htmlFor="hw-due">
                {t("editor.dueDate")}
                <OptionalNote />
              </FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="hw-due"
                  type="date"
                  className="w-44"
                  value={dueDate}
                  min={lesson?.teachingDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-invalid={errors.dueDate ? true : undefined}
                />
                {weekAfter && dueDate !== weekAfter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setDueDate(weekAfter)}
                  >
                    {t("editor.weekAfter", { date: f.dayMonth(weekAfter) })}
                  </Button>
                ) : null}
                {dueDate ? (
                  <Button type="button" variant="ghost" size="xs" onClick={() => setDueDate("")}>
                    {t("editor.clearDue")}
                  </Button>
                ) : null}
              </div>
              {errors.dueDate ? (
                <FieldError>{errors.dueDate}</FieldError>
              ) : (
                <FieldDescription>{t("editor.dueHint")}</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </FormPanel>

        <FormPanel title={t("editor.resources")} optional>
          <div className="flex flex-col gap-3">
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("editor.resourcesEmpty")}</p>
            ) : null}
            {resources.map((r, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    aria-label={t("editor.resource", { n: i + 1 })}
                    placeholder={t("editor.resourcePlaceholder")}
                    value={r.label}
                    maxLength={120}
                    onChange={(e) =>
                      setResources((list) =>
                        list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                      )
                    }
                  />
                  <div className="relative col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <Link2
                      className="pointer-events-none absolute start-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      aria-label={t("editor.resourceLink", { n: i + 1 })}
                      placeholder="https://"
                      className="ps-5"
                      value={r.url ?? ""}
                      onChange={(e) =>
                        setResources((list) =>
                          list.map((x, j) => (j === i ? { ...x, url: e.target.value || null } : x))
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editor.resourceRemove", { n: i + 1 })}
                    onClick={() => setResources((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {errors[`resources.${i}`] ? (
                  <FieldError>{errors[`resources.${i}`]}</FieldError>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={resources.length >= 10}
              onClick={() => setResources((list) => [...list, { label: "", url: null }])}
            >
              <Plus data-icon="inline-start" />
              {t("editor.addResource")}
            </Button>
          </div>
        </FormPanel>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <Smartphone className="size-4" aria-hidden="true" />
            {t("editor.preview")}
          </h2>
          {hw ? <HomeworkStatusBadge status={hw.status} /> : <HomeworkStatusBadge status="draft" />}
        </div>
        <div
          className="border bg-background p-5 shadow-xs ring-8 ring-muted"
          aria-label={t("editor.previewLabel")}
        >
          <ParentHomeworkView
            compact
            headingLevel="h3"
            child={{ name: null, stage: editor.stage.name }}
            title={title}
            instructions={instructions}
            dueDate={dueDate || null}
            today={editor.today}
            lesson={lesson}
            resources={resources
              .filter((r) => r.label.trim() || (r.url ?? "").trim())
              .map((r) => ({ label: r.label || r.url || "", url: r.url }))}
            status={
              <span
                className="flex h-11 items-center justify-center gap-2 bg-primary text-xs font-semibold tracking-wider text-primary-foreground uppercase"
                aria-hidden="true"
              >
                <Check className="size-4" />
                {tp("markDone")}
              </span>
            }
          />
        </div>
        <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
          <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {published
            ? t("editor.visible", {
                count: editor.childrenInStage,
                stage: editor.stage.name,
                completions: editor.completions,
              })
            : t("editor.hiddenUntilPublished", {
                count: editor.childrenInStage,
                stage: editor.stage.name,
              })}
        </p>

        <div className="flex flex-col gap-2 border-t pt-4">
          {published ? (
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {tc("saveChanges")}
            </Button>
          ) : (
            <>
              <Button type="button" disabled={pending || !lessonId} onClick={() => save(true)}>
                {pending && intent === "publish" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {t("actions.publishToParents")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !lessonId}
                onClick={() => save(false)}
              >
                {pending && intent === "draft" ? <Spinner data-icon="inline-start" /> : null}
                {t("editor.saveDraft")}
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" asChild>
            <Link
              href={
                hw
                  ? `${stageBase}/lessons/${lessonId}`
                  : lessonId
                    ? `${stageBase}/lessons/${lessonId}`
                    : `${stageBase}/homework`
              }
            >
              {tc("cancel")}
            </Link>
          </Button>
        </div>
      </aside>
    </form>
  )
}
