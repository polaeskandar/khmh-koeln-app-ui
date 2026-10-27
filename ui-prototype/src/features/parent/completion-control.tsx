"use client"

/**
 * Mark a homework task as done for one child, or undo it (P04 → P05).
 * The tick shows at once (optimistic) and is confirmed by the server, which
 * treats a second tap as the same report. Undo is always possible and keeps
 * the history. Wording stays plain: no scores, no "late".
 */
import { startTransition, useOptimistic } from "react"
import { Check, CircleCheck, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import { completeHomeworkAction, undoCompletionAction } from "@/server/actions/learning"

type Done = {
  done: boolean
  completedAt: string | null
  completedByYou: boolean
  completedBy: string | null
}

export function CompletionControl({
  homeworkId,
  childId,
  childName,
  today,
  initial,
}: {
  homeworkId: string
  childId: string
  childName: string
  today: LocalDate
  initial: Done
}) {
  const t = useTranslations("parent.completion")
  const f = useFormat()
  const [state, setState] = useOptimistic(initial)

  const complete = () =>
    startTransition(async () => {
      setState({ done: true, completedAt: null, completedByYou: true, completedBy: null })
      const r = await completeHomeworkAction(homeworkId, childId)
      if (!r.ok) toast.error(r.problem.detail ?? r.problem.title)
    })

  const undo = () =>
    startTransition(async () => {
      setState({ done: false, completedAt: null, completedByYou: false, completedBy: null })
      const r = await undoCompletionAction(homeworkId, childId)
      if (!r.ok) toast.error(r.problem.detail ?? r.problem.title)
      else toast(t("undone", { name: childName }))
    })

  if (!state.done) {
    return (
      <div className="flex flex-col gap-2">
        <Button size="lg" className="h-12 w-full sm:w-auto sm:self-start" onClick={complete}>
          <Check data-icon="inline-start" />
          {t("markDone")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("hint", { name: childName })}</p>
      </div>
    )
  }

  const when = state.completedAt ? f.atLabel(state.completedAt, today) : null
  return (
    <div
      className="flex flex-col gap-3 border border-success/40 bg-success-soft p-4 sm:flex-row sm:items-center"
      role="status"
    >
      <CircleCheck className="size-8 shrink-0 text-success" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-base font-semibold">{t("done")}</span>
        <span className="text-sm text-muted-foreground">
          {when === null
            ? t("saving")
            : state.completedByYou
              ? t("byYou", { when })
              : state.completedBy
                ? t("byName", { name: state.completedBy, when })
                : t("byParent", { when })}
        </span>
      </div>
      <Button variant="outline" size="sm" className="self-start sm:self-center" onClick={undo}>
        <Undo2 data-icon="inline-start" />
        {t("undo")}
      </Button>
    </div>
  )
}
