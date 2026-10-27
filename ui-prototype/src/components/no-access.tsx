import Link from "next/link"
import { LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/** Shown instead of a form or list the viewer may not use. The server enforces the same rule. */
export function NoAccess({
  title,
  children,
  back,
}: {
  title: string
  children: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockKeyhole />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {back ? (
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={back.href}>{back.label}</Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
