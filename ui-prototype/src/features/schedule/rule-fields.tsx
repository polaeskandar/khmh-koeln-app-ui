"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"

import { OptionalInput, OptionalNote, TextField } from "@/components/form-fields"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useFormat } from "@/i18n/format"
import { ISO_WEEKDAYS, type MonthWeek, type PlanRule } from "@/lib/domain/types"

type Pattern = "weekly" | "biweekly" | "monthly"

const patternOf = (rule: PlanRule): Pattern =>
  rule.frequency === "monthly" ? "monthly" : rule.interval === 2 ? "biweekly" : "weekly"

function Select({
  label,
  value,
  onChange,
  children,
  error,
  optional,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  error?: string
  optional?: boolean
}) {
  const id = useId()

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <OptionalNote /> : null}
      </FieldLabel>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      >
        {children}
      </NativeSelect>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

export function RuleFields({
  rule,
  onChange,
  errors,
  year,
  hideDates,
}: {
  rule: PlanRule
  onChange: (rule: PlanRule) => void
  errors: Record<string, string>
  year: number
  hideDates?: boolean
}) {
  const t = useTranslations("schedule.rule")
  const f = useFormat()
  const set = (patch: Partial<PlanRule>) => onChange({ ...rule, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("repeats")}
          value={patternOf(rule)}
          onChange={(value) => {
            const pattern = value as Pattern
            set(
              pattern === "monthly"
                ? { frequency: "monthly", interval: 1, monthWeek: rule.monthWeek ?? 1 }
                : { frequency: "weekly", interval: pattern === "biweekly" ? 2 : 1, monthWeek: null }
            )
          }}
          error={errors.interval}
        >
          <NativeSelectOption value="weekly">{t("weekly")}</NativeSelectOption>
          <NativeSelectOption value="biweekly">{t("biweekly")}</NativeSelectOption>
          <NativeSelectOption value="monthly">{t("monthly")}</NativeSelectOption>
        </Select>
        <Select
          label={t("weekday")}
          value={String(rule.weekday)}
          onChange={(value) => set({ weekday: Number(value) as PlanRule["weekday"] })}
        >
          {ISO_WEEKDAYS.map((d) => (
            <NativeSelectOption key={d} value={d}>
              {f.weekdayName(d)}
            </NativeSelectOption>
          ))}
        </Select>
      </div>
      {rule.frequency === "monthly" ? (
        <Select
          label={t("week")}
          value={String(rule.monthWeek ?? 1)}
          onChange={(value) => set({ monthWeek: Number(value) as MonthWeek })}
        >
          {([1, 2, 3, 4, -1] as MonthWeek[]).map((w) => (
            <NativeSelectOption key={w} value={w}>
              {t("weekOfMonth", { week: f.monthWeekName(w), day: f.weekdayName(rule.weekday) })}
            </NativeSelectOption>
          ))}
        </Select>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          type="time"
          label={t("start")}
          value={rule.startTime}
          onChange={(e) => set({ startTime: e.target.value })}
          error={errors.startTime}
        />
        <OptionalInput
          type="time"
          label={t("end")}
          value={rule.endTime}
          onChange={(endTime) => set({ endTime })}
          error={errors.endTime}
          description={t("endHint")}
        />
      </div>
      {hideDates ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionalInput
            type="date"
            label={t("firstDate")}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            value={rule.startsOn}
            onChange={(startsOn) => set({ startsOn })}
            error={errors.startsOn}
            description={t("firstDateHint", { year: String(year) })}
          />
          <OptionalInput
            type="date"
            label={t("lastDate")}
            min={`${year}-01-01`}
            value={rule.endsOn}
            onChange={(endsOn) => set({ endsOn })}
            error={errors.endsOn}
            description={t("lastDateHint", { year: String(year) })}
          />
        </div>
      )}
      <OptionalInput
        type="text"
        label={t("location")}
        value={rule.location}
        onChange={(location) => set({ location })}
        error={errors.location}
        placeholder={t("locationPlaceholder")}
      />
      <FieldDescription className="text-xs">{t("timeZone")}</FieldDescription>
    </div>
  )
}
