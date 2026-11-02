"use client"

// A client component because the preset's toggle styles live in a client module.
import Link from "next/link"
import { cn } from "cn"

import { toggleVariants } from "@/components/ui/toggle"

/**
 * A choice between a few options where each option is its own URL: the preset's outline toggle
 * group, made of links, with the chosen one filled like the toggles in the schedule dialog.
 */
export function ChoiceLinks({
  label,
  items,
  active,
}: {
  label: string
  items: { key: string; label: string; href: string; lang?: string }[]
  active: string
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <ul className="flex flex-wrap">
        {items.map((item) => {
          const current = item.key === active
          return (
            <li key={item.key} className="-ms-px first:ms-0">
              <Link
                href={item.href}
                scroll={false}
                lang={item.lang}
                aria-current={current ? "true" : undefined}
                className={cn(
                  toggleVariants({ variant: "outline", size: "sm" }),
                  "relative focus-visible:z-20",
                  current &&
                    "z-10 border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
