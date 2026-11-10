import { Layers } from "lucide-react"
import { useTranslations } from "next-intl"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/**
 * Shown instead of a list or the dashboard to staff whose roles hold only in assigned groups and
 * who have none yet: they see no service until the church office assigns them.
 */
export function NotAssigned() {
  const t = useTranslations("assignments.notAssigned")
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
