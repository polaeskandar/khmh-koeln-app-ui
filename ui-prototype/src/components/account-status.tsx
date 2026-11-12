import { CircleCheck, KeyRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { StatusBadge } from "@/components/status"

export function AccountStatusBadge({ status }: { status: "active" | "mustChange" }) {
  const t = useTranslations("accounts.status")

  return status === "mustChange" ? (
    <StatusBadge tone="warning" icon={KeyRound}>
      {t("mustChange")}
    </StatusBadge>
  ) : (
    <StatusBadge tone="success" icon={CircleCheck}>
      {t("active")}
    </StatusBadge>
  )
}
