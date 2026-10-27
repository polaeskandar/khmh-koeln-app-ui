"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

/** Narrows a page to one service; the choice lives in the URL (?service=…). */
export function ServiceFilter({
  services,
  value,
  basePath,
  params = {},
}: {
  services: { id: string; name: string }[]
  value: string | null
  basePath: string
  /** Other query parameters to keep. */
  params?: Record<string, string | null | undefined>
}) {
  const router = useRouter()
  const t = useTranslations("meetings")
  return (
    <NativeSelect
      aria-label={t("fields.service")}
      className="w-full sm:w-56"
      value={value ?? ""}
      onChange={(e) => {
        const q = new URLSearchParams()
        for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
        if (e.target.value) q.set("service", e.target.value)
        const query = q.toString()
        router.push(query ? `${basePath}?${query}` : basePath)
      }}
    >
      <NativeSelectOption value="">{t("filter.allServices")}</NativeSelectOption>
      {services.map((s) => (
        <NativeSelectOption key={s.id} value={s.id}>
          {s.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
