import { cn } from "cn"

import type { ServiceRef } from "@/lib/view-models"

/** Identity colour of a service (slot 1–8). Only ever a small square next to the name. */
export function ServiceSwatch({ tone, className }: { tone: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0", className)}
      style={{ background: `var(--identity-${tone})` }}
    />
  )
}

/** Service identity: a small square swatch plus the service name. */
export function ServiceTag({
  service,
  label,
  className,
}: {
  service: Pick<ServiceRef, "name" | "tone">
  label?: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-muted-foreground", className)}
    >
      <ServiceSwatch tone={service.tone} />
      <span className="truncate">{label ?? service.name}</span>
    </span>
  )
}
