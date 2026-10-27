"use client"

import { useCallback, useState, useTransition } from "react"
import { toast } from "sonner"

import type { ActionResult, Problem } from "@/server/errors"

/**
 * Calls a server action inside a transition and turns its result into UI
 * feedback: a toast for success and for errors without field details, and
 * field errors for forms (the same shape as the API's 422 violations).
 */
export function useServerAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  options: { onSuccess?: (data: T) => void; toastOnSuccess?: boolean } = {}
) {
  const [pending, startTransition] = useTransition()
  const [problem, setProblem] = useState<Problem | null>(null)
  const { onSuccess, toastOnSuccess = true } = options

  const execute = useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          setProblem(null)
          const result = await action(...args)
          if (result.ok) {
            if (toastOnSuccess && result.message) toast.success(result.message)
            onSuccess?.(result.data)
          } else {
            setProblem(result.problem)
            if (!result.problem.fieldErrors)
              toast.error(result.problem.detail ?? result.problem.title)
          }
          resolve(result)
        })
      }),
    [action, onSuccess, toastOnSuccess]
  )

  return {
    execute,
    pending,
    problem,
    fieldErrors: problem?.fieldErrors ?? {},
    reset: () => setProblem(null),
  }
}
