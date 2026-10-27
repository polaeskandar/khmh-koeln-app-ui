"use client"

/**
 * Create or edit a recurring meeting schedule in a modal. The meeting (who and
 * where) sits on the start side, its rhythm (when) on the end side, with a
 * preview of the next dates. Editing a schedule is kept visibly separate from
 * editing one session: the dialog says which sessions a change affects, and
 * single dates are changed from the session itself.
 */
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Info, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { TextAreaField, TextField } from "@/components/form-fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import {
  normalizeWeekdays,
  occurrencesBetween,
  RecurrenceError,
  type RecurrenceProblem,
  validateRecurrence,
} from "@/lib/domain/recurrence"
import { addDays } from "@/lib/domain/time"
import type { IsoWeekday, LocalDate, MonthWeek, Recurrence, RosterMode } from "@/lib/domain/types"
import type { ScheduleSummary } from "@/lib/view-models"
import { createScheduleAction, updateScheduleAction } from "@/server/actions/meetings"
import type { FormService } from "@/server/queries/meetings"

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]
const MONTH_WEEKS: MonthWeek[] = [1, 2, 3, 4, -1]

/**
 * The preset marks a pressed toggle with the muted background only, which is
 * too faint to tell the chosen weekdays apart (WCAG 1.4.11), so these toggles
 * use the primary colour when they are on.
 */
const SELECTED =
  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"

type Draft = {
  serviceId: string
  stageId: string
  name: string
  description: string
  location: string
  frequency: "weekly" | "monthly"
  interval: number
  weekdays: IsoWeekday[]
  monthWeek: MonthWeek
  monthWeekday: IsoWeekday
  startsOn: string
  endsOn: string
  startTime: string
  endTime: string
  rosterMode: RosterMode
}

function initialDraft(
  today: LocalDate,
  services: FormService[],
  fixed: { serviceId?: string; stageId?: string },
  schedule?: ScheduleSummary
): Draft {
  if (schedule) {
    const r = schedule.recurrence
    return {
      serviceId: schedule.service.id,
      stageId: schedule.stage?.id ?? "",
      name: schedule.name,
      description: schedule.description ?? "",
      location: schedule.location ?? "",
      frequency: r.frequency,
      interval: r.interval,
      weekdays: r.frequency === "weekly" ? r.weekdays : [7],
      monthWeek: r.monthWeek ?? 1,
      monthWeekday: r.weekdays[0],
      startsOn: r.startsOn,
      endsOn: r.endsOn ?? "",
      startTime: schedule.startTime,
      endTime: schedule.endTime ?? "",
      rosterMode: schedule.rosterMode,
    }
  }
  const service =
    services.find((s) => s.id === fixed.serviceId) ?? services.find((s) => s.canManage)
  return {
    serviceId: service?.id ?? "",
    stageId: fixed.stageId ?? "",
    name: "",
    description: "",
    location: "",
    frequency: "weekly",
    interval: 1,
    weekdays: [7],
    monthWeek: 1,
    monthWeekday: 6,
    startsOn: today,
    endsOn: "",
    startTime: "18:00",
    endTime: "19:30",
    rosterMode: "expected",
  }
}

function toRecurrence(d: Draft): Recurrence {
  return {
    frequency: d.frequency,
    interval: d.interval,
    weekdays: d.frequency === "weekly" ? normalizeWeekdays(d.weekdays) : [d.monthWeekday],
    monthWeek: d.frequency === "monthly" ? d.monthWeek : null,
    startsOn: d.startsOn,
    endsOn: d.endsOn || null,
  }
}

type Preview =
  | { error: RecurrenceProblem; dates: LocalDate[]; recurrence: null }
  | { error: null; dates: LocalDate[]; recurrence: Recurrence }

/** The next dates the pattern produces, so people can check it before saving. */
function usePreview(d: Draft, today: LocalDate): Preview {
  return useMemo(() => {
    const r = toRecurrence(d)
    try {
      validateRecurrence(r)
    } catch (e) {
      if (e instanceof RecurrenceError) return { error: e.code, dates: [], recurrence: null }
      throw e
    }
    const from = d.startsOn > today ? d.startsOn : today
    return {
      error: null,
      dates: occurrencesBetween(r, from, addDays(from, 400)).slice(0, 4),
      recurrence: r,
    }
  }, [d, today])
}

export function ScheduleDialog({
  services,
  today,
  schedule,
  fixedServiceId,
  fixedStageId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  services: FormService[]
  today: LocalDate
  schedule?: ScheduleSummary
  fixedServiceId?: string
  fixedStageId?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const t = useTranslations("meetings")
  const tc = useTranslations("common")
  const te = useTranslations("errors.recurrence")
  const f = useFormat()
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen
  const fixed = { serviceId: fixedServiceId, stageId: fixedStageId }
  const [d, setD] = useState<Draft>(() => initialDraft(today, services, fixed, schedule))
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }))
  const create = useServerAction(createScheduleAction, {
    onSuccess: (r) => {
      setOpen(false)
      router.push(`/meetings/schedules/${r.id}`)
    },
  })
  const update = useServerAction(updateScheduleAction, { onSuccess: () => setOpen(false) })
  const action = schedule ? update : create
  const errors = action.fieldErrors
  const preview = usePreview(d, today)
  const service = services.find((s) => s.id === d.serviceId)
  const stage = service?.stages.find((s) => s.id === d.stageId)
  const rosterSize = stage ? stage.members : (service?.serviceLevelMembers ?? 0)
  const group = stage?.name ?? service?.name
  const editable = services.filter((s) => s.canManage)

  /** When the generator creates the first session: right away for today and tomorrow, else the day before. */
  function firstCreated(first: LocalDate) {
    if (first <= addDays(today, 1)) return t("form.firstRightAway")
    const createdOn = addDays(first, -1)
    return createdOn === addDays(today, 1)
      ? t("form.firstTomorrow")
      : t("form.firstOn", { date: f.dayMonth(createdOn) })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      serviceId: d.serviceId,
      stageId: d.stageId || null,
      name: d.name,
      description: d.description || null,
      location: d.location || null,
      frequency: d.frequency,
      interval: d.interval,
      weekdays: d.frequency === "weekly" ? d.weekdays : [d.monthWeekday],
      monthWeek: d.frequency === "monthly" ? d.monthWeek : null,
      startsOn: d.startsOn,
      endsOn: d.endsOn || null,
      startTime: d.startTime,
      endTime: d.endTime || null,
      rosterMode: d.rosterMode,
    }
    if (schedule) update.execute(schedule.id, input)
    else create.execute(input)
  }

  const intervalSelect = (label: string, options: number[]) => (
    <NativeSelect
      aria-label={label}
      className="w-16"
      value={String(d.interval)}
      onChange={(e) => set("interval", Number(e.target.value))}
    >
      {options.map((n) => (
        <NativeSelectOption key={n} value={n}>
          {n}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setD(initialDraft(today, services, fixed, schedule))
          create.reset()
          update.reset()
        }
        setOpen(next)
      }}
    >
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" />
            {t("form.newButton")}
          </Button>
        </DialogTrigger>
      ) : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-4xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b p-6 pe-16">
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              {schedule ? t("actions.edit") : t("form.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {schedule
                ? `${schedule.group} · ${f.recurrence(schedule.recurrence)}`
                : t("form.newDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            {schedule ? (
              <Alert>
                <Info />
                <AlertTitle>{t("form.editAlertTitle")}</AlertTitle>
                <AlertDescription>{t("form.editAlertDescription")}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-y-8 md:grid-cols-2">
              {/* The meeting: whose it is, what it is called, where and for whom. */}
              <FieldGroup className="gap-6 md:pe-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={errors.serviceId ? true : undefined}>
                    <FieldLabel htmlFor="schedule-service">{t("fields.service")}</FieldLabel>
                    <NativeSelect
                      id="schedule-service"
                      className="w-full"
                      value={d.serviceId}
                      disabled={!!schedule || !!fixedServiceId}
                      onChange={(e) =>
                        setD((prev) => ({ ...prev, serviceId: e.target.value, stageId: "" }))
                      }
                    >
                      {(schedule || fixedServiceId ? services : editable).map((s) => (
                        <NativeSelectOption key={s.id} value={s.id}>
                          {s.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
                  </Field>
                  <Field data-invalid={errors.stageId ? true : undefined}>
                    <FieldLabel htmlFor="schedule-stage">{t("fields.stage")}</FieldLabel>
                    <NativeSelect
                      id="schedule-stage"
                      className="w-full"
                      value={d.stageId}
                      disabled={!!fixedStageId}
                      onChange={(e) => set("stageId", e.target.value)}
                    >
                      <NativeSelectOption value="">{t("fields.wholeService")}</NativeSelectOption>
                      {service?.stages.map((st) => (
                        <NativeSelectOption key={st.id} value={st.id}>
                          {st.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {errors.stageId ? <FieldError>{errors.stageId}</FieldError> : null}
                  </Field>
                </div>
                <TextField
                  label={t("fields.name")}
                  value={d.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  maxLength={120}
                  placeholder={t("form.namePlaceholder")}
                  description={t("form.nameHint")}
                  error={errors.name}
                />
                <TextField
                  label={t("fields.place")}
                  optional
                  value={d.location}
                  onChange={(e) => set("location", e.target.value)}
                  maxLength={120}
                  placeholder={t("form.placePlaceholder")}
                  error={errors.location}
                />
                <FieldSet>
                  <FieldLegend>{t("fields.whoIsExpected")}</FieldLegend>
                  <RadioGroup
                    value={d.rosterMode}
                    onValueChange={(v) => set("rosterMode", v as RosterMode)}
                  >
                    <Field orientation="horizontal">
                      <RadioGroupItem value="expected" id="roster-expected" />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="roster-expected" className="font-normal">
                          {group ? t("form.rosterOf", { group }) : t("form.rosterOfService")}
                        </FieldLabel>
                        <FieldDescription>
                          {[
                            t("form.rosterToday", { count: rosterSize }),
                            stage
                              ? t("form.rosterStage")
                              : service && service.stages.length > 0
                                ? t("form.rosterServiceOnly")
                                : t("form.rosterService"),
                            t("form.rosterHint"),
                          ].join(" ")}
                        </FieldDescription>
                      </div>
                    </Field>
                    <Field orientation="horizontal">
                      <RadioGroupItem value="open" id="roster-open" />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="roster-open" className="font-normal">
                          {t("roster.open")}
                        </FieldLabel>
                        <FieldDescription>{t("form.openHint")}</FieldDescription>
                      </div>
                    </Field>
                  </RadioGroup>
                </FieldSet>
                <TextAreaField
                  label={t("form.notes")}
                  optional
                  value={d.description}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={500}
                  error={errors.description}
                />
              </FieldGroup>

              {/* Its rhythm: how it repeats, at what time, from when to when. */}
              <div className="flex min-w-0 flex-col gap-6 md:border-s md:ps-8">
                <FieldSet>
                  <FieldLegend>{t("schedule.repeats")}</FieldLegend>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    spacing={0}
                    value={d.frequency}
                    onValueChange={(v) => v && set("frequency", v as Draft["frequency"])}
                    aria-label={t("form.frequency")}
                  >
                    <ToggleGroupItem value="weekly" className={SELECTED}>
                      {t("form.weekly")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="monthly" className={SELECTED}>
                      {t("form.monthly")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {d.frequency === "weekly" ? (
                    <div className="flex flex-col gap-3">
                      {/* The selects sit inside the sentence, wherever each language puts them. */}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {t.rich("form.everyWeeks", {
                          count: d.interval,
                          interval: () => intervalSelect(t("form.weeksInterval"), [1, 2, 3, 4]),
                        })}
                      </div>
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        spacing={0}
                        value={d.weekdays.map(String)}
                        onValueChange={(v) => set("weekdays", v.map(Number) as IsoWeekday[])}
                        aria-label={t("form.weekdays")}
                        className="flex-wrap"
                      >
                        {WEEKDAYS.map((w) => (
                          <ToggleGroupItem
                            key={w}
                            value={String(w)}
                            aria-label={f.weekdayName(w)}
                            className={cn("px-3!", SELECTED)}
                          >
                            {f.weekdayMin(w)}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {t.rich("form.monthlyOn", {
                        count: d.interval,
                        week: () => (
                          <NativeSelect
                            aria-label={t("form.monthWeek")}
                            className="w-24"
                            value={String(d.monthWeek)}
                            onChange={(e) => set("monthWeek", Number(e.target.value) as MonthWeek)}
                          >
                            {MONTH_WEEKS.map((w) => (
                              <NativeSelectOption key={w} value={w}>
                                {f.monthWeekName(w)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ),
                        weekday: () => (
                          <NativeSelect
                            aria-label={t("form.weekday")}
                            className="w-32"
                            value={String(d.monthWeekday)}
                            onChange={(e) =>
                              set("monthWeekday", Number(e.target.value) as IsoWeekday)
                            }
                          >
                            {WEEKDAYS.map((w) => (
                              <NativeSelectOption key={w} value={w}>
                                {f.weekdayName(w)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ),
                        interval: () => intervalSelect(t("form.monthsInterval"), [1, 2, 3, 6]),
                      })}
                    </div>
                  )}
                  {errors.weekdays || errors.interval ? (
                    <FieldError>{errors.weekdays ?? errors.interval}</FieldError>
                  ) : null}
                </FieldSet>

                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label={t("form.startsAt")}
                    type="time"
                    required
                    value={d.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    error={errors.startTime}
                  />
                  <TextField
                    label={t("form.endsAt")}
                    type="time"
                    optional
                    value={d.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                    error={errors.endTime}
                  />
                  <TextField
                    label={t("form.firstDate")}
                    type="date"
                    required
                    value={d.startsOn}
                    onChange={(e) => set("startsOn", e.target.value)}
                    error={errors.startsOn}
                  />
                  <TextField
                    label={t("form.lastDate")}
                    type="date"
                    optional
                    value={d.endsOn}
                    onChange={(e) => set("endsOn", e.target.value)}
                    description={t("form.lastDateHint")}
                    error={errors.endsOn}
                  />
                </div>

                <div aria-live="polite" className="flex flex-col gap-1.5 bg-muted/60 p-4 text-sm">
                  <span className="text-xs font-semibold tracking-wider uppercase">
                    {t("form.preview")}
                  </span>
                  {preview.error ? (
                    <span className="text-muted-foreground">{te(preview.error)}</span>
                  ) : preview.dates.length === 0 ? (
                    <span className="text-muted-foreground">{t("form.previewNone")}</span>
                  ) : (
                    <>
                      <span>
                        {t("form.previewPattern", {
                          pattern: f.recurrence(preview.recurrence),
                          time: f.timeRange(d.startTime, d.endTime || null),
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {t("form.previewNext", {
                          dates: preview.dates
                            .map((date) => f.dayMonth(date))
                            .join(t("form.dateSeparator")),
                        })
                          // A sentence that ends in an abbreviated month ("29. Nov.") gets no second period.
                          .replace(/\.\.$/, ".")}{" "}
                        {firstCreated(preview.dates[0])}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={action.pending || editable.length === 0}>
              {action.pending ? <Spinner data-icon="inline-start" /> : null}
              {schedule ? t("form.save") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
