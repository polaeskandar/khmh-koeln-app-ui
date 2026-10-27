"use client"

/** A session outside every schedule, for example an extra rehearsal or a trip. */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import type { LocalDate } from "@/lib/domain/types"
import { createOneOffSessionAction } from "@/server/actions/meetings"
import type { FormService } from "@/server/queries/meetings"

export function OneOffSessionDialog({
  services,
  today,
}: {
  services: FormService[]
  today: LocalDate
}) {
  const router = useRouter()
  const t = useTranslations("meetings")
  const tc = useTranslations("common")
  const editable = services.filter((s) => s.canManage)
  const [open, setOpen] = useState(false)
  const [serviceId, setServiceId] = useState(editable[0]?.id ?? "")
  const [stageId, setStageId] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState("18:00")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [rosterMode, setRosterMode] = useState<"expected" | "open">("expected")
  const create = useServerAction(createOneOffSessionAction, {
    onSuccess: (id) => {
      setOpen(false)
      router.push(`/meetings/sessions/${id}`)
    },
  })
  const errors = create.fieldErrors
  const service = editable.find((s) => s.id === serviceId)
  const stage = service?.stages.find((s) => s.id === stageId)
  const members = stage ? stage.members : (service?.serviceLevelMembers ?? 0)
  const group = stage?.name ?? service?.name

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) create.reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus data-icon="inline-start" />
          {t("oneOff.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("oneOff.title")}</DialogTitle>
          <DialogDescription>{t("oneOff.description")}</DialogDescription>
        </DialogHeader>
        <form
          id="one-off-form"
          onSubmit={(e) => {
            e.preventDefault()
            create.execute({
              serviceId,
              stageId: stageId || null,
              title,
              location: location || null,
              date,
              startTime,
              endTime: endTime || null,
              rosterMode,
            })
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.serviceId ? true : undefined}>
                <FieldLabel htmlFor="one-off-service">{t("fields.service")}</FieldLabel>
                <NativeSelect
                  id="one-off-service"
                  className="w-full"
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value)
                    setStageId("")
                  }}
                >
                  {editable.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
              </Field>
              <Field data-invalid={errors.stageId ? true : undefined}>
                <FieldLabel htmlFor="one-off-stage">{t("fields.stage")}</FieldLabel>
                <NativeSelect
                  id="one-off-stage"
                  className="w-full"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
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
              label={t("fields.title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t("oneOff.titlePlaceholder")}
              error={errors.title}
            />
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <TextField
                label={t("fields.date")}
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                required
                error={errors.date}
              />
              <TextField
                label={t("fields.starts")}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                error={errors.startTime}
              />
              <TextField
                label={t("fields.ends")}
                optional
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                error={errors.endTime}
              />
            </div>
            <TextField
              label={t("fields.place")}
              optional
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder={t("fields.placePlaceholder")}
              error={errors.location}
            />
            <Field>
              <FieldTitle id="one-off-roster" className="tracking-wide">
                {t("fields.whoIsExpected")}
              </FieldTitle>
              <RadioGroup
                aria-labelledby="one-off-roster"
                value={rosterMode}
                onValueChange={(v) => setRosterMode(v as "expected" | "open")}
                className="gap-2"
              >
                <label className="flex items-start gap-2.5 text-sm">
                  <RadioGroupItem value="expected" className="mt-0.5" />
                  <span>
                    {group ? t("oneOff.membersOf", { group }) : t("oneOff.membersOfService")}
                    <span className="block text-xs text-muted-foreground">
                      {t("oneOff.onRosterToday", { count: members })}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm">
                  <RadioGroupItem value="open" className="mt-0.5" />
                  <span>
                    {t("roster.open")}
                    <span className="block text-xs text-muted-foreground">
                      {t("oneOff.openHint")}
                    </span>
                  </span>
                </label>
              </RadioGroup>
              <FieldDescription>{t("oneOff.hint")}</FieldDescription>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="one-off-form" disabled={create.pending || !serviceId}>
            {create.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("oneOff.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
