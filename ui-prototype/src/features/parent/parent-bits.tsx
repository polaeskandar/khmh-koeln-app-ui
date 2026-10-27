import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { MemberAvatar } from "@/components/member-avatar"
import { useFormat } from "@/i18n/format"
import type { LocalDate } from "@/lib/domain/types"
import type { ChildSummary, ParentTask } from "@/server/queries/parent"

import { DueLine } from "../homework/homework-bits"

/**
 * Pick a child. Each child is a link (?child=…), so the choice survives a
 * reload and can be shared between the parent's devices.
 */
export function ChildSwitcher({
  items,
  selectedId,
  href,
}: {
  items: ChildSummary[]
  selectedId?: string
  href: string
}) {
  const t = useTranslations("parent.switcher")
  if (items.length === 0) return null
  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-2">
        {items.map((c) => {
          const current = c.id === selectedId
          return (
            <li key={c.id}>
              <Link
                href={`${href}?child=${c.id}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-14 items-center gap-3 border px-3 pe-4 transition-colors hover:bg-muted/60",
                  current && "border-foreground bg-muted/40 ring-1 ring-foreground"
                )}
              >
                <MemberAvatar name={c.fullName} initials={c.initials} seed={c.id} />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.stage ?? t("noClass")} ·{" "}
                    {c.toDo > 0 ? t("toDo", { count: c.toDo }) : t("allDone")}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** A homework task in the parent's list. Opens the task; the tick happens there. */
export function TaskCard({ task, today }: { task: ParentTask; today: LocalDate }) {
  const t = useTranslations("parent.task")
  const f = useFormat()
  const when = task.done ? f.atLabel(task.completedAt!, today) : ""
  return (
    <Link
      href={`/parent/homework/${task.id}?child=${task.childId}`}
      className={cn(
        "flex items-center gap-4 border p-4 transition-colors hover:bg-muted/60",
        task.done && "bg-muted/30"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center border",
          task.done
            ? "border-success bg-success text-success-foreground"
            : "border-dashed text-transparent"
        )}
        aria-hidden="true"
      >
        <Check className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-heading text-base leading-snug font-semibold tracking-tight">
          {task.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {task.lessonTitle} · {task.stage}
        </span>
        {task.done ? (
          <span className="text-xs text-success">
            {task.completedByYou
              ? t("doneByYou", { when })
              : task.completedBy
                ? t("doneBy", { name: task.completedBy, when })
                : t("doneByParent", { when })}
          </span>
        ) : (
          <DueLine dueDate={task.dueDate} today={today} />
        )}
      </span>
      <span className="sr-only">{task.done ? t("done") : t("toDo")}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export function TaskList({
  title,
  tasks,
  today,
  empty,
}: {
  title: string
  tasks: ParentTask[]
  today: LocalDate
  empty?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="flex items-baseline gap-2 font-heading text-base font-semibold tracking-tight">
        {title}
        <span className="text-sm font-normal text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </h2>
      {tasks.length === 0 ? (
        empty ? (
          <div className="border border-dashed p-5 text-sm text-muted-foreground">{empty}</div>
        ) : null
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li key={`${t.childId}-${t.id}`}>
              <TaskCard task={t} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
