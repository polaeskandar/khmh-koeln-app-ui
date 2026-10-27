"use client"

/**
 * Lesson preparation editor (S02). Built from the shadcnblocks form patterns
 * ("form-layouts", "field" groups): plain text areas instead of a rich-text
 * editor, as agreed for the MVP. Internal teaching material and the parts
 * parents will see are labelled differently on purpose.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Link2, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FormPanel } from "@/components/form-panel"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { addDays } from "@/lib/domain/time"
import type { LocalDate, Material } from "@/lib/domain/types"
import type { Format } from "@/lib/format"
import { createLessonAction, updateLessonAction } from "@/server/actions/learning"
import type { LessonForm } from "@/server/queries/learning"

import { LessonStatusBadge } from "./lesson-bits"
import { type Audience, VisibilityNote } from "./visibility"
import { isolate } from "@/lib/bidi"

/** A group of fields, marked with who will read it. */
function Block({
  title,
  who,
  children,
  className,
}: {
  title: string
  who?: Audience
  children: React.ReactNode
  className?: string
}) {
  return (
    <FormPanel
      title={title}
      note={who ? <VisibilityNote who={who} /> : null}
      className={cn(
        who === "servants" && "bg-muted/30",
        who === "parents" && "border-s-4 border-s-success",
        className
      )}
    >
      {children}
    </FormPanel>
  )
}

type MeetingOption = LessonForm["options"][number]
type LessonsT = ReturnType<typeof useTranslations<"lessons">>

/** Explains how the lesson will be linked, in the servant's terms. */
function meetingHint(
  option: MeetingOption | undefined,
  today: LocalDate,
  t: LessonsT,
  f: Format
): string {
  if (!option) return t("editor.hint.none")
  switch (option.state) {
    case "planned":
      return t("editor.hint.planned", { date: f.dayMonth(addDays(option.date, -1)) })
    case "canceled":
      return t("editor.hint.canceled")
    case "completed":
      return t("editor.hint.completed")
    default:
      return option.date === today ? t("editor.hint.today") : t("editor.hint.exists")
  }
}

function optionLabel(
  o: MeetingOption,
  today: LocalDate,
  current: string,
  t: LessonsT,
  f: Format
): string {
  return [
    t("editor.option.when", {
      day: o.date === today ? f.relativeDay(o.date, today) : f.dayMonth(o.date),
      time: o.startTime,
    }),
    o.title,
    o.state === "canceled"
      ? t("editor.option.canceled")
      : o.state === "completed"
        ? t("meeting.held")
        : null,
    o.takenBy && o.value !== current
      ? t("editor.option.taken", { title: isolate(o.takenBy.title) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function LessonEditor({ form, base }: { form: LessonForm; base: string }) {
  const t = useTranslations("lessons")
  const tc = useTranslations("common")
  const f = useFormat()
  const router = useRouter()
  const lesson = form.lesson
  const [title, setTitle] = useState(lesson?.title ?? "")
  const [summary, setSummary] = useState(lesson?.summary ?? "")
  const [passage, setPassage] = useState(lesson?.passage ?? "")
  const [memoryVerse, setMemoryVerse] = useState(lesson?.memoryVerse ?? "")
  const [objectives, setObjectives] = useState(lesson?.objectives ?? "")
  const [teachingPoints, setTeachingPoints] = useState(lesson?.teachingPoints ?? "")
  const [activities, setActivities] = useState(lesson?.activities ?? "")
  const [notes, setNotes] = useState(lesson?.notes ?? "")
  const [materials, setMaterials] = useState<Material[]>(
    lesson?.materials.length ? lesson.materials : [{ label: "", url: null }]
  )
  // "other" stands for a date without a meeting; the date itself is kept separately.
  const [meeting, setMeeting] = useState(
    form.meetingValue.startsWith("date:") ? "other" : form.meetingValue
  )
  const [otherDate, setOtherDate] = useState(
    form.meetingValue.startsWith("date:") ? form.meetingValue.slice(5) : form.today
  )
  const servantIds = new Set(form.servants.map((s) => s.id))
  const [responsibleId, setResponsibleId] = useState(
    lesson?.responsibleId ??
      (servantIds.has(form.viewerId) ? form.viewerId : (form.servants[0]?.id ?? ""))
  )
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(lesson?.collaboratorIds ?? [])
  const [intent, setIntent] = useState<"draft" | "ready" | null>(null)

  const create = useServerAction(createLessonAction, {
    onSuccess: (r) => router.push(`${base}/${r.id}`),
  })
  const update = useServerAction(updateLessonAction, {
    onSuccess: (r) => router.push(`${base}/${r.id}`),
  })
  const action = lesson ? update : create
  const errors = action.fieldErrors

  const input = () => ({
    title,
    meeting: meeting === "other" ? `date:${otherDate}` : meeting,
    summary: summary || null,
    passage: passage || null,
    objectives: objectives || null,
    teachingPoints: teachingPoints || null,
    memoryVerse: memoryVerse || null,
    activities: activities || null,
    notes: notes || null,
    materials: materials.filter((m) => m.label.trim() || (m.url ?? "").trim()),
    responsibleId,
    collaboratorIds,
  })

  const submit = (status: "draft" | "ready") => {
    setIntent(status)
    if (lesson)
      update.execute(lesson.id, input(), lesson.status === "completed" ? undefined : status)
    else create.execute(form.stage.id, input(), status === "ready")
  }

  const selectedOption = form.options.find((o) => o.value === meeting)
  const pending = action.pending

  return (
    <form
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]"
      onSubmit={(e) => {
        e.preventDefault()
        submit(lesson?.status === "ready" ? "ready" : "draft")
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <Block title={t("lesson")}>
          <FieldGroup>
            <TextField
              label={t("editor.title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
              placeholder={t("editor.titlePlaceholder")}
              autoFocus={!lesson}
              error={errors.title}
            />
            <TextAreaField
              label={t("editor.summary")}
              optional
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={1000}
              placeholder={t("editor.summaryPlaceholder")}
              className="[&_textarea]:min-h-16"
              error={errors.summary}
            />
          </FieldGroup>
        </Block>

        <Block title={t("editor.scripture")} who="parents">
          <FieldGroup>
            <TextField
              label={t("fields.passage")}
              optional
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              maxLength={200}
              placeholder={t("editor.passagePlaceholder")}
              error={errors.passage}
            />
            <TextAreaField
              label={t("fields.memoryVerse")}
              optional
              value={memoryVerse}
              onChange={(e) => setMemoryVerse(e.target.value)}
              maxLength={500}
              placeholder={t("editor.memoryVersePlaceholder")}
              className="[&_textarea]:min-h-16"
              error={errors.memoryVerse}
            />
          </FieldGroup>
        </Block>

        <Block title={t("fields.teachingPlan")} who="servants">
          <FieldGroup>
            <TextAreaField
              label={t("fields.objectives")}
              optional
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder={t("editor.objectivesPlaceholder")}
              error={errors.objectives}
            />
            <TextAreaField
              label={t("fields.teachingPoints")}
              optional
              value={teachingPoints}
              onChange={(e) => setTeachingPoints(e.target.value)}
              description={t("editor.teachingPointsHint")}
              error={errors.teachingPoints}
            />
            <TextAreaField
              label={t("fields.activities")}
              optional
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              description={t("editor.activitiesHint")}
              error={errors.activities}
            />
          </FieldGroup>
        </Block>

        <Block title={t("fields.materials")} who="servants">
          <div className="flex flex-col gap-3">
            {materials.map((m, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    aria-label={t("editor.material", { n: i + 1 })}
                    placeholder={t("editor.materialPlaceholder")}
                    value={m.label}
                    maxLength={120}
                    onChange={(e) =>
                      setMaterials((list) =>
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
                      aria-label={t("editor.materialLink", { n: i + 1 })}
                      placeholder={t("editor.materialLinkPlaceholder")}
                      className="ps-5"
                      value={m.url ?? ""}
                      onChange={(e) =>
                        setMaterials((list) =>
                          list.map((x, j) => (j === i ? { ...x, url: e.target.value || null } : x))
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editor.removeMaterial", { n: i + 1 })}
                    onClick={() =>
                      setMaterials((list) =>
                        list.length === 1
                          ? [{ label: "", url: null }]
                          : list.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                {errors[`materials.${i}`] ? (
                  <FieldError>{errors[`materials.${i}`]}</FieldError>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={materials.length >= 10}
              onClick={() => setMaterials((list) => [...list, { label: "", url: null }])}
            >
              <Plus data-icon="inline-start" />
              {t("editor.addMaterial")}
            </Button>
          </div>
        </Block>

        <Block title={t("fields.notes")} who="servants">
          <TextAreaField
            label={t("editor.notesLabel")}
            optional
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("editor.notesPlaceholder")}
            error={errors.notes}
          />
        </Block>
      </div>

      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <FormPanel title={t("editor.when")}>
          <Field data-invalid={errors.meeting ? true : undefined}>
            <FieldLabel htmlFor="lesson-meeting">{t("editor.meeting")}</FieldLabel>
            <NativeSelect
              id="lesson-meeting"
              className="w-full"
              value={meeting}
              onChange={(e) => setMeeting(e.target.value)}
            >
              {form.options.map((o) => (
                <NativeSelectOption
                  key={o.value}
                  value={o.value}
                  disabled={
                    (!!o.takenBy || o.state === "canceled") && o.value !== form.meetingValue
                  }
                >
                  {optionLabel(o, form.today, form.meetingValue, t, f)}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="other">{t("editor.otherDate")}</NativeSelectOption>
            </NativeSelect>
            {meeting === "other" ? (
              <Input
                type="date"
                aria-label={t("fields.teachingDate")}
                value={otherDate}
                onChange={(e) => setOtherDate(e.target.value)}
                className="mt-2"
              />
            ) : null}
            {errors.meeting ? (
              <FieldError>{errors.meeting}</FieldError>
            ) : (
              <FieldDescription>{meetingHint(selectedOption, form.today, t, f)}</FieldDescription>
            )}
          </Field>
        </FormPanel>

        <FormPanel title={t("fields.servants")}>
          <Field data-invalid={errors.responsibleId ? true : undefined}>
            <FieldLabel htmlFor="lesson-responsible">{t("fields.responsible")}</FieldLabel>
            <NativeSelect
              id="lesson-responsible"
              className="w-full"
              value={responsibleId}
              onChange={(e) => setResponsibleId(e.target.value)}
            >
              {form.servants.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {errors.responsibleId ? <FieldError>{errors.responsibleId}</FieldError> : null}
          </Field>
          {form.servants.length > 1 ? (
            <Field>
              <FieldTitle id="lesson-helping" className="tracking-wide">
                {t("editor.helping")}
              </FieldTitle>
              <div role="group" aria-labelledby="lesson-helping" className="flex flex-col gap-2">
                {form.servants
                  .filter((s) => s.id !== responsibleId)
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={collaboratorIds.includes(s.id)}
                        onCheckedChange={(v) =>
                          setCollaboratorIds((ids) =>
                            v ? [...ids, s.id] : ids.filter((x) => x !== s.id)
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
              {errors.collaboratorIds ? <FieldError>{errors.collaboratorIds}</FieldError> : null}
            </Field>
          ) : null}
        </FormPanel>

        <FormPanel
          title={t("fields.status")}
          note={<LessonStatusBadge status={lesson?.status ?? "draft"} />}
          className="gap-3"
        >
          <p className="text-xs text-muted-foreground">{t("editor.statusHint")}</p>
          <div className="flex flex-col gap-2">
            {lesson?.status === "completed" ? (
              <Button type="button" onClick={() => submit("ready")} disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {tc("saveChanges")}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={() => submit("ready")} disabled={pending}>
                  {pending && intent === "ready" ? <Spinner data-icon="inline-start" /> : null}
                  {lesson?.status === "ready" ? tc("save") : t("actions.markReady")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submit("draft")}
                  disabled={pending}
                >
                  {pending && intent === "draft" ? <Spinner data-icon="inline-start" /> : null}
                  {lesson?.status === "ready" ? t("editor.saveAsDraft") : t("editor.saveDraft")}
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" asChild>
              <Link href={lesson ? `${base}/${lesson.id}` : base}>{tc("cancel")}</Link>
            </Button>
          </div>
        </FormPanel>
      </aside>
    </form>
  )
}
