"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { ServiceStructure, Unit } from "@/lib/domain/types"

export type ScopeChoice = {
  serviceId: string
  name: string
  structure: ServiceStructure
  stages: { id: string; name: string }[]
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
