import "server-only"

import { epochOf, localDateOf } from "@/lib/domain/time"

import { nowMs } from "./clock"
import { generate } from "./generator"
import { getState, type State } from "./state"

const HOUR = 3_600_000

/** The most recent scheduled run (every hour at minute 5) at or before the instant. */
function lastSlot(ms: number): number {
  const slot = Math.floor(ms / HOUR) * HOUR + 5 * 60_000
  return slot > ms ? slot - HOUR : slot
}

/**
 * Simulates the planned hourly backend job (at minute 5) on the demo clock:
 * the first page load after each :05 runs the generator once. Idempotent, as
 * the real job must be.
 */
export function ensureGenerated(s: State): void {
  const slot = lastSlot(nowMs())
  const last = s.generatorRuns.at(-1)
  if (last && epochOf(last.ranAt) >= slot) return
  s.generatorRuns.push(generate(s, localDateOf(slot), slot))
  if (s.generatorRuns.length > 48) s.generatorRuns.splice(0, s.generatorRuns.length - 48)
}

/** The mock database, with the session generator brought up to date. */
export function openState(): State {
  const s = getState()
  ensureGenerated(s)
  return s
}
