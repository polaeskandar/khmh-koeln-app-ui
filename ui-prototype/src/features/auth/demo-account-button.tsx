"use client"

import { useTransition } from "react"

import { signInAsAction } from "@/server/actions/prototype"

export function DemoAccountButton({
  id,
  name,
  username,
  summary,
}: {
  id: string
  name: string
  username: string
  summary: string
}) {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => signInAsAction(id))}
      className="flex w-full flex-col items-start border p-3 text-start hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="font-medium">{name}</span>
      <span className="text-xs text-muted-foreground" dir="ltr">
        {username}
      </span>
      <span className="text-xs text-muted-foreground">{summary}</span>
    </button>
  )
}
