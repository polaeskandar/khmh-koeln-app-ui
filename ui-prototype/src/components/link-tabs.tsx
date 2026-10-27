import Link from "next/link"
import { cn } from "cn"

/**
 * Tabs that are links (each tab is its own URL). Styled like the preset's
 * "line" tabs; scrolls sideways on small screens instead of wrapping.
 */
export function LinkTabs({
  items,
  active,
  className,
  label,
}: {
  items: { href: string; label: string; key: string; count?: number }[]
  active: string
  className?: string
  label: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn("-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0", className)}
    >
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const current = item.key === active
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 px-3 text-xs font-semibold tracking-wider whitespace-nowrap text-foreground/60 uppercase transition-colors hover:text-foreground",
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0",
                  current && "text-foreground after:opacity-100"
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="bg-muted px-1.5 py-0.5 text-[10px] tracking-normal text-muted-foreground tabular-nums">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
