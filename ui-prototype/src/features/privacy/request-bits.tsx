import { Ban, CheckCheck, CircleAlert, Clock, Hourglass } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { StatusBadge } from "@/components/status"
import { useFormat } from "@/i18n/format"
import type { DataRequestRow } from "@/server/queries/privacy"

/** Who the request is about: their name, or once erased, what they were ("a member of 3rd Class"). */
export function useSubjectLabel() {
  const t = useTranslations("privacy.subject")
  return (r: Pick<DataRequestRow, "subjectName" | "erasedSubject">) => {
    if (r.subjectName) return r.subjectName
    const erased = r.erasedSubject
    if (erased?.kind === "member") {
      return erased.group ? t("erasedMemberOf", { group: erased.group }) : t("erasedMember")
    }
    return t("erasedAccount")
  }
}

export function KindLabel({ kind }: { kind: DataRequestRow["kind"] }) {
  const t = useTranslations("privacy.kind")
  return <>{t(kind)}</>
}

/** The due date, with how much time is left: quiet while there is time, then a warning, then late. */
export function DueLabel({ request }: { request: Pick<DataRequestRow, "dueOn" | "daysLeft"> }) {
  const t = useTranslations("privacy.due")
  const f = useFormat()
  const late = request.daysLeft < 0
  const soon = !late && request.daysLeft <= 7
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        late ? "font-medium text-destructive" : soon ? "font-medium text-warning" : ""
      )}
    >
      {late ? (
        <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      ) : soon ? (
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span>
        {f.dayMonth(request.dueOn)}
        <span className={cn("ms-1.5", !late && !soon && "text-muted-foreground")}>
          {late
            ? t("late", { count: -request.daysLeft })
            : request.daysLeft === 0
              ? t("today")
              : t("left", { count: request.daysLeft })}
        </span>
      </span>
    </span>
  )
}

export function RequestStatusBadge({ status }: { status: DataRequestRow["status"] }) {
  const t = useTranslations("privacy.status")
  return (
    <StatusBadge
      tone={status === "open" ? "info" : status === "done" ? "success" : "neutral"}
      icon={status === "open" ? Hourglass : status === "done" ? CheckCheck : Ban}
    >
      {t(status)}
    </StatusBadge>
  )
}

/** The subject as a heading: the name, or the neutral description once the data is erased. */
export function SubjectName({
  request,
}: {
  request: Pick<DataRequestRow, "subjectName" | "erasedSubject">
}) {
  const label = useSubjectLabel()
  return <>{label(request)}</>
}
