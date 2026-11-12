"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { Scope, ServiceStructure, Unit } from "@/lib/domain/types"

export type ScopeChoice = {
  serviceId: string
  name: string
  structure: ServiceStructure
  stages: { id: string; name: string }[]
}

export function scopeKey(scope: Scope): string {
  if (scope.type === "church") {
    return "church"
  }

  return scope.type === "service"
    ? `service:${scope.serviceId}`
    : `stage:${scope.serviceId}:${scope.stageId}`
}

function parseScope(key: string): Scope {
  const [type, serviceId, stageId] = key.split(":")

  if (type === "service") {
    return { type: "service", serviceId }
  }

  return type === "stage" ? { type: "stage", serviceId, stageId } : { type: "church" }
}

export function ScopePicker({
  label,
  scopes,
  value,
  onChange,
  allowChurch,
  churchOnly,
}: {
  label: string
  scopes: ScopeChoice[]
  value: Scope
  onChange: (scope: Scope) => void
  allowChurch: boolean
  churchOnly?: boolean
}) {
  const t = useTranslations("access.scope")
  const id = useId()

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={scopeKey(value)}
        onChange={(e) => onChange(parseScope(e.target.value))}
        disabled={churchOnly}
      >
        {allowChurch || churchOnly ? (
          <NativeSelectOption value="church">{t("church")}</NativeSelectOption>
        ) : null}
        {churchOnly
          ? null
          : scopes.map((x) => (
              <NativeSelectOptGroup key={x.serviceId} label={x.name}>
                <NativeSelectOption value={`service:${x.serviceId}`}>
                  {x.structure === "stages" ? t("wholeService", { name: x.name }) : x.name}
                </NativeSelectOption>
                {x.stages.map((st) => (
                  <NativeSelectOption key={st.id} value={`stage:${x.serviceId}:${st.id}`}>
                    {`${x.name} - ${st.name}`}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
      </NativeSelect>
    </Field>
  )
}

export function UnitPicker({
  scopes,
  value,
  onChange,
}: {
  scopes: ScopeChoice[]
  value: Unit[]
  onChange: (units: Unit[]) => void
}) {
  const has = (u: Unit) => value.some((v) => v.serviceId === u.serviceId && v.stageId === u.stageId)
  const toggle = (u: Unit) =>
    onChange(
      has(u)
        ? value.filter((v) => !(v.serviceId === u.serviceId && v.stageId === u.stageId))
        : [...value, u]
    )
  const units = scopes.flatMap<{ unit: Unit; label: string }>((x) =>
    x.structure === "single"
      ? [{ unit: { serviceId: x.serviceId, stageId: null }, label: x.name }]
      : x.stages.map((st) => ({
          unit: { serviceId: x.serviceId, stageId: st.id },
          label: `${x.name} - ${st.name}`,
        }))
  )

  return (
    <ul className="grid max-h-56 gap-1.5 overflow-y-auto border p-3 sm:grid-cols-2">
      {units.map(({ unit, label }) => (
        <li key={`${unit.serviceId}-${unit.stageId}`}>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={has(unit)} onCheckedChange={() => toggle(unit)} />
            {label}
          </label>
        </li>
      ))}
    </ul>
  )
}
