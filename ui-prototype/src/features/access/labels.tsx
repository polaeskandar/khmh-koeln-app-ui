"use client"

import {
  BookOpen,
  Box,
  CalendarClock,
  Church,
  GraduationCap,
  Layers,
  ListChecks,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import type { Action } from "@/lib/domain/resources"

const ICONS: Record<string, typeof Box> = {
  church: Church,
  service: Layers,
  stage: GraduationCap,
  session: CalendarClock,
  lesson: BookOpen,
  task: ListChecks,
}

/** The icon of a resource type; a plain box for types added later. */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Box

  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden="true" />
}

type Lookup = ((key: string) => string) & { has: (key: string) => boolean }

/** Names of resource types and actions, with the type's own key as a fallback for new types. */
export function useAccessWords() {
  const t = useTranslations("access") as unknown as Lookup

  return {
    type: (type: string, plural = false) =>
      t.has(`types.${type}.one`) ? t(`types.${type}.${plural ? "other" : "one"}`) : type,
    action: (action: Action) => t(`actions.${action}`),
  }
}
