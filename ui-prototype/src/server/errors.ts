import { type Message, msg } from "@/i18n/message"

/**
 * Errors raised by the data layer, shaped after the backend's RFC 9457
 * problem details so the UI handles the mock and the real API the same way:
 *  - 403 forbidden: the role does not allow it
 *  - 404 not found
 *  - 409 business rule: the request is valid but the current state forbids it
 *  - 422 validation: field errors, keyed by field name
 *
 * The data layer names its messages by key (like the API's error codes); the
 * server action translates them into the person's language before the UI sees
 * them.
 */
export type ProblemStatus = 403 | 404 | 409 | 422

/** What the UI receives: text in the person's language. */
export type Problem = {
  status: ProblemStatus
  title: string
  detail?: string
  fieldErrors?: Record<string, string>
}

/** What the data layer raises: message keys and values. */
export type ProblemSource = {
  status: ProblemStatus
  /** Instead of the standard title for the status. */
  title?: Message
  detail?: Message
  fieldErrors?: Record<string, Message>
}

export class ProblemError extends Error {
  constructor(readonly problem: ProblemSource) {
    super(problem.detail?.key ?? `problem ${problem.status}`)
  }
}

/** The kinds of record a 404 can be about. */
export type Thing =
  | "service"
  | "stage"
  | "person"
  | "membership"
  | "schedule"
  | "session"
  | "attendance"
  | "lesson"
  | "homework"
  | "user"
  | "guardian"
  | "request"

export const forbidden = (detail: Message = msg("errors.forbidden")) =>
  new ProblemError({ status: 403, detail })

export const notFound = (what: Thing) =>
  new ProblemError({ status: 404, detail: msg(`errors.notFound.${what}`) })

export const ruleViolation = (detail: Message) => new ProblemError({ status: 409, detail })

export const invalid = (
  fieldErrors: Record<string, Message>,
  detail: Message = msg("errors.checkFields")
) => new ProblemError({ status: 422, detail, fieldErrors })

export type ActionResult<T = undefined> =
  { ok: true; data: T; message?: string } | { ok: false; problem: Problem }
