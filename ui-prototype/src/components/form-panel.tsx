import { useId } from "react"
import { cn } from "cn"

import { OptionalNote } from "@/components/form-fields"

/**
 * A bordered group of form fields with a small heading, e.g. "Scripture" or
 * "When". A labelled group instead of a fieldset legend, which browsers draw
 * inside the border line.
 */
export function FormPanel({
  title,
  optional = false,
  note,
  children,
  className,
}: {
  title: string
  /** Marks the whole group as optional, like a single optional field. */
  optional?: boolean
  /** Shown opposite the heading, e.g. who can read this part. */
  note?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col gap-5 border p-5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-xs font-semibold tracking-wider uppercase">
          {title}
          {optional ? <OptionalNote /> : null}
        </h2>
        {note}
      </div>
      {children}
    </div>
  )
}
