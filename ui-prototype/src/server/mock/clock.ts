import "server-only"

import { localDateOf, toInstant } from "@/lib/domain/time"
import type { Instant, LocalDate } from "@/lib/domain/types"

/**
 * The prototype runs on a demo clock: it starts at Sunday 8 November 2026,
 * 12:08 in Cologne, when the Sunday School classes have just begun, and then
 * moves forward in real time. Set KHMK_DEMO_CLOCK=frozen to keep it at the
 * start time (used for the screenshots).
 */
export const DEMO_START = Date.parse("2026-11-08T12:08:00+01:00")

const holder = globalThis as typeof globalThis & { __khmkClockStartedAt?: number }

export function nowMs(): number {
  if (process.env.KHMK_DEMO_CLOCK === "frozen") return DEMO_START
  const real = Date.now()
  holder.__khmkClockStartedAt ??= real
  return DEMO_START + (real - holder.__khmkClockStartedAt)
}

export function resetClock(): void {
  holder.__khmkClockStartedAt = Date.now()
}

export const now = (): Instant => toInstant(nowMs())
export const today = (): LocalDate => localDateOf(nowMs())
