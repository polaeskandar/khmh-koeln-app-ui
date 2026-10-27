"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, NotebookPen, UserRound, UsersRound, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

/** `key` names the page in the "parent.nav" messages. */
type Item = { href: string; key: "home" | "children" | "homework" | "account"; icon: LucideIcon }

/** The parent portal's four destinations, as agreed: Home, My children, Homework, Account. */
export const PARENT_NAV: Item[] = [
  { href: "/parent", key: "home", icon: House },
  { href: "/parent/children", key: "children", icon: UsersRound },
  { href: "/parent/homework", key: "homework", icon: NotebookPen },
  { href: "/parent/account", key: "account", icon: UserRound },
]

const isActive = (href: string, pathname: string | null) =>
  !!pathname &&
  (href === "/parent"
    ? pathname === "/parent"
    : pathname === href || pathname.startsWith(`${href}/`))

export function ParentDesktopNav({ pathname }: { pathname?: string | null }) {
  const t = useTranslations("parent.nav")
  return (
    <nav aria-label={t("label")} className="hidden items-stretch gap-1 self-stretch md:flex">
      {PARENT_NAV.map((item) => {
        const active = isActive(item.href, pathname ?? null)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center px-3 text-xs font-semibold tracking-wider whitespace-nowrap text-foreground/60 uppercase hover:text-foreground",
              "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0",
              active && "text-foreground after:opacity-100"
            )}
          >
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}

export function ParentTabBar({ pathname }: { pathname?: string | null }) {
  const t = useTranslations("parent.nav")
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {PARENT_NAV.map((item) => {
        const active = isActive(item.href, pathname ?? null)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              active && "text-foreground"
            )}
          >
            <item.icon className="size-5" aria-hidden="true" />
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}

/** Navigation with the current page marked; reads the URL, so it renders at request time. */
export function ActiveParentDesktopNav() {
  return <ParentDesktopNav pathname={usePathname()} />
}

export function ActiveParentTabBar() {
  return <ParentTabBar pathname={usePathname()} />
}
