import { cn } from "cn"

/** Title, one line of context and the page's actions. The title is the page's only h1. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
  actionsClassName,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
  /** For example `hidden md:flex` when the actions only make sense on a larger screen. */
  actionsClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {meta ? <div className="flex flex-wrap items-center gap-2 text-sm">{meta}</div> : null}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance md:text-[28px]">
          {/* Titles are often typed by someone (a lesson, a service); bdi keeps their punctuation in place in either direction. */}
          {typeof title === "string" ? <bdi>{title}</bdi> : title}
        </h1>
        {description ? (
          <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className={cn("flex shrink-0 flex-wrap items-center gap-2", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}

/** A titled block inside a page. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)} aria-labelledby={id}>
      <div className="flex min-h-8 flex-col gap-x-6 gap-y-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="max-w-[80ch] text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
