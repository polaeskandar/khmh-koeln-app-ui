"use client"

import {
  BookOpen,
  Box,
  CalendarClock,
  CalendarDays,
  Church,
  DoorOpen,
  FileLock,
  GraduationCap,
  KeyRound,
  Layers,
  ListChecks,
  PartyPopper,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import type { CapabilityGroup, PermissionGroup } from "@/lib/domain/resources"

const ICONS: Record<string, typeof Box> = {
  church: Church,
  service: Layers,
  stage: GraduationCap,
  schedule: CalendarDays,
  session: CalendarClock,
  lesson: BookOpen,
  task: ListChecks,
  event: PartyPopper,
  account: UserRound,
  role: ShieldCheck,
  guardianship: Users,
  dataRequest: FileLock,
  access: KeyRound,
  portal: DoorOpen,
}

/** The icon of a resource type or permission group; a plain box for types added later. */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Box

  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden="true" />
}

type Lookup = ((key: string, values?: Record<string, unknown>) => string) & {
  has: (key: string) => boolean
}

/** Human labels for resource types, actions and permission groups, with fallbacks for new ones. */
export function useAccessLabels() {
  const t = useTranslations("access") as unknown as Lookup
  const tp = useTranslations("permissions") as unknown as Lookup
  const type = (name: string, plural = false) =>
    t.has(`types.${name}.one`) ? t(`types.${name}.${plural ? "other" : "one"}`) : name
  const action = (name: string) => (tp.has(`actions.${name}`) ? tp(`actions.${name}`) : name)

  return {
    type,
    action,
    group: (group: PermissionGroup) => type(group, true),
    types: (list: string[]) => list.map((x) => type(x, true)).join(", "),
  }
}

/** "Lessons · View, Change, Publish" for each group, as a compact list. */
export function CapabilityList({
  groups,
  className,
  tone = "default",
}: {
  groups: CapabilityGroup[]
  className?: string
  tone?: "default" | "added" | "removed" | "muted"
}) {
  const labels = useAccessLabels()

  return (
    <ul className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {groups.map((g) => (
        <li key={g.group} className="flex items-start gap-2">
          <TypeIcon
            type={g.group}
            className={cn(
              "mt-0.5 size-3.5",
              tone === "added" && "text-primary",
              tone === "removed" && "text-destructive",
              (tone === "default" || tone === "muted") && "text-muted-foreground"
            )}
          />
          <span className={cn("min-w-0", tone === "muted" && "text-muted-foreground")}>
            <span className="font-medium">{labels.group(g.group)}</span>
            <span className="text-muted-foreground"> · </span>
            {g.actions.map((a) => labels.action(a)).join(", ")}
          </span>
        </li>
      ))}
    </ul>
  )
}
