"use client"

import { CheckCircle2, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import { setTaskDoneAction } from "@/server/actions/learning"

export function TaskDoneToggle({
  taskId,
  personId,
  done,
  name,
}: {
  taskId: string
  personId: string
  done: boolean
  name: string | null
}) {
  const t = useTranslations("portal")
  const { execute, pending } = useServerAction(setTaskDoneAction)

  return done ? (
    <Button variant="outline" disabled={pending} onClick={() => execute(taskId, personId, false)}>
      <Undo2 data-icon="inline-start" />
      {t("undo")}
    </Button>
  ) : (
    <Button size="lg" disabled={pending} onClick={() => execute(taskId, personId, true)}>
      <CheckCircle2 data-icon="inline-start" />
      {name ? t("markDoneFor", { name }) : t("markDone")}
    </Button>
  )
}
