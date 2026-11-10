"use client"

/**
 * Choosing where a staff account serves (polaeskandar/khmh-koeln-app-backend#318): a service,
 * then one of its stages or the whole service. The whole service covers its own roster and all
 * its stages, as for a service leader; a stage covers that stage only.
 */
import { useId, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { assignGroupAction } from "@/server/actions/accounts"

export type GroupOption = { id: string; name: string; stages: { id: string; name: string }[] }

export type ChosenGroup = { serviceId: string; stageId: string | null }

/** The service select and, once a service with stages is chosen, the stage select. */
export function GroupFields({
  services,
  value,
  onChange,
  errors = {},
  fixedService = false,
}: {
  services: GroupOption[]
  value: { serviceId: string; stageId: string | null }
  onChange: (value: { serviceId: string; stageId: string | null }) => void
  errors?: Record<string, string | undefined>
  /** On a service's own page the service is given: only the stage is chosen. */
  fixedService?: boolean
}) {
  const t = useTranslations("assignments")
  const id = useId()
  const service = services.find((x) => x.id === value.serviceId)
  return (
    <>
      {fixedService ? null : (
        <Field data-invalid={errors.serviceId ? true : undefined}>
          <FieldLabel htmlFor={`${id}-service`}>{t("service")}</FieldLabel>
          <NativeSelect
            id={`${id}-service`}
            className="w-full"
            value={value.serviceId}
            onChange={(e) => onChange({ serviceId: e.target.value, stageId: null })}
          >
            <NativeSelectOption value="" disabled>
              {t("chooseService")}
            </NativeSelectOption>
            {services.map((x) => (
              <NativeSelectOption key={x.id} value={x.id}>
                {x.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
        </Field>
      )}
      {service && service.stages.length > 0 ? (
        <Field data-invalid={errors.stageId ? true : undefined}>
          <FieldLabel htmlFor={`${id}-stage`}>{t("stage")}</FieldLabel>
          <NativeSelect
            id={`${id}-stage`}
            className="w-full"
            value={value.stageId ?? ""}
            onChange={(e) => onChange({ ...value, stageId: e.target.value || null })}
          >
            <NativeSelectOption value="">{t("wholeService")}</NativeSelectOption>
            {service.stages.map((st) => (
              <NativeSelectOption key={st.id} value={st.id}>
                {st.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t("stageHint")}</FieldDescription>
          {errors.stageId ? <FieldError>{errors.stageId}</FieldError> : null}
        </Field>
      ) : null}
    </>
  )
}

/** "Assign to a group…" for one account, from Settings › Staff accounts and roles. */
export function AssignGroupDialog({
  user,
  services,
  open,
  onOpenChange,
}: {
  user: { id: string; name: string }
  services: GroupOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("assignments")
  const tc = useTranslations("common")
  const [group, setGroup] = useState<ChosenGroup>({ serviceId: "", stageId: null })
  const assign = useServerAction(assignGroupAction, { onSuccess: () => onOpenChange(false) })
  return (
    <Dialog open={open} onOpenChange={(next) => !assign.pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8 leading-snug">
            {t("dialog.title", { name: user.name })}
          </DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form
          id={`assign-${user.id}`}
          onSubmit={(e) => {
            e.preventDefault()
            assign.execute(user.id, group)
          }}
        >
          <FieldGroup>
            <GroupFields
              services={services}
              value={group}
              onChange={setGroup}
              errors={assign.fieldErrors}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assign.pending}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form={`assign-${user.id}`}
            disabled={assign.pending || !group.serviceId}
          >
            {assign.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
