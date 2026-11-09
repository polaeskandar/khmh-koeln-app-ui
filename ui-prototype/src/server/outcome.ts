import "server-only"

import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { getViewer } from "./viewer"

/**
 * What just happened to someone who isn't signed in, for the page that explains it: a sign-in
 * refused because the email address isn't confirmed yet or the office hasn't approved the
 * account, or a registration accepted. Only that outcome opens its page; a typed address, an
 * older outcome or a signed-in account gets the 404 page. The cookie lasts for the browser
 * session, so the page survives a reload and a language switch, and signing in clears it.
 */
export const OUTCOME_COOKIE = "khmk-outcome"

export type Outcome = "unconfirmed" | "pending" | "registered"

export async function rememberOutcome(outcome: Outcome) {
  const store = await cookies()
  store.set(OUTCOME_COOKIE, outcome, { httpOnly: true, sameSite: "lax", path: "/" })
}

/** For a status page: renders only right after its outcome, for someone not signed in. */
export async function requireOutcome(outcome: Outcome) {
  const [store, viewer] = await Promise.all([cookies(), getViewer()])
  if (viewer || store.get(OUTCOME_COOKIE)?.value !== outcome) notFound()
}
