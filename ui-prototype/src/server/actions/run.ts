import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { Message } from "@/i18n/message"
import { getMessageTranslator } from "@/i18n/server"
import { type ActionResult, type Problem, ProblemError } from "@/server/errors"
import { openState } from "@/server/mock/runtime"
import type { State } from "@/server/mock/state"
import { type Context, getContext } from "@/server/viewer"

type Translate = Awaited<ReturnType<typeof getMessageTranslator>>

const TITLES = {
  403: "errors.title.forbidden",
  404: "errors.title.notFound",
  409: "errors.title.conflict",
  422: "errors.title.invalid",
} as const

function toProblem(error: ProblemError, translate: Translate): Problem {
  const { status, title, detail, fieldErrors } = error.problem
  return {
    status,
    title: translate(title ?? { key: TITLES[status] }),
    detail: detail ? translate(detail) : undefined,
    fieldErrors: fieldErrors
      ? Object.fromEntries(Object.entries(fieldErrors).map(([k, m]) => [k, translate(m)]))
      : undefined,
  }
}

async function attempt<T>(
  mutate: () => Promise<T> | T,
  message?: Message | ((result: T) => Message)
): Promise<ActionResult<T>> {
  const translate = await getMessageTranslator()
  try {
    const data = await mutate()
    revalidatePath("/", "layout")
    const success = typeof message === "function" ? message(data) : message
    return { ok: true, data, message: success ? translate(success) : undefined }
  } catch (error) {
    if (error instanceof ProblemError) return { ok: false, problem: toProblem(error, translate) }
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        problem: {
          status: 422,
          title: translate({ key: "errors.title.invalid" }),
          detail: translate({ key: "errors.invalidRequest" }),
        },
      }
    }
    throw error
  }
}

/**
 * Runs one mutation for a server action: resolves the signed-in person, applies
 * the command, refreshes every page that may show the change, and turns
 * business errors into a problem the UI can display (like the API's 4xx).
 * Success messages and problems are translated into the person's language.
 * Without a session, the person is sent to sign-in.
 */
export async function run<T>(
  mutate: (ctx: Context) => T,
  message?: Message | ((result: T) => Message)
): Promise<ActionResult<T>> {
  return attempt(async () => mutate(await getContext()), message)
}

/** Like run, for the few actions that work without a session: registration, sign-in. */
export async function runPublic<T>(
  mutate: (state: State) => T,
  message?: Message | ((result: T) => Message)
): Promise<ActionResult<T>> {
  return attempt(() => mutate(openState()), message)
}

export const id = z.uuid()
export const optionalId = z.uuid().nullable()
export const text = z.string().max(5000)
export const optionalText = z.string().max(5000).nullable().optional()
