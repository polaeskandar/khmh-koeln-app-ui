"use client"

/**
 * Bottom tab bar for phones, adapted from shadcnblocks "application-shell30".
 * Taking attendance is the raised centre action. Hidden while a session's
 * attendance screen is open, which has its own bottom bar.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardCheck, Menu } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ViewerInfo } from "@/lib/view-models"

import { isActive, NAV, SETTINGS, type NavItem } from "./nav"
import { PersonaMenuContent } from "./sidebar-parts"

const byHref = (href: string) => NAV.find((i) => i.href === href)!

function Tab({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const t = useTranslations("nav")
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
        active && "text-foreground"
      )}
    >
      <item.icon className="size-5" />
      {t(item.key)}
      {badge ? (
        <span className="absolute start-1/2 top-1.5 ms-1.5 flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export function MobileTabBar({
  pathname,
  openSessions = 0,
  viewer,
  personas,
}: {
  pathname?: string | null
  openSessions?: number
  viewer?: ViewerInfo
  personas?: ViewerInfo[]
}) {
  const t = useTranslations("nav")
  const moreItems = [byHref("/services"), SETTINGS]
  const moreActive = moreItems.some((i) => isActive(i.href, pathname))
  const attendanceActive = isActive("/attendance", pathname)
  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <Tab item={byHref("/")} active={isActive("/", pathname)} />
      <Tab item={byHref("/meetings")} active={isActive("/meetings", pathname)} />
      <div className="flex flex-1 flex-col items-center">
        <Link
          href="/attendance"
          aria-label={t("takeAttendance")}
          aria-current={attendanceActive ? "page" : undefined}
          className="relative -mt-5 flex size-14 items-center justify-center bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <ClipboardCheck className="size-6" />
          {openSessions > 0 ? (
            <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-foreground px-1 text-[10px] text-background">
              {openSessions}
            </span>
          ) : null}
        </Link>
        <span
          className={cn(
            "mt-0.5 text-[11px] font-medium text-muted-foreground",
            attendanceActive && "text-foreground"
          )}
        >
          {t("attendance")}
        </span>
      </div>
      <Tab item={byHref("/members")} active={isActive("/members", pathname)} />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none",
            moreActive && "text-foreground"
          )}
        >
          <Menu className="size-5" />
          {t("more")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" side="top" align="end">
          {moreItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <item.icon />
                {t(item.key)}
              </Link>
            </DropdownMenuItem>
          ))}
          {viewer && personas ? (
            <>
              <DropdownMenuSeparator />
              <PersonaMenuContent viewer={viewer} personas={personas} />
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}

/** The tab bar with the current page highlighted; hidden on a session's attendance screen. */
export function ActiveMobileTabBar(props: {
  openSessions?: number
  viewer?: ViewerInfo
  personas?: ViewerInfo[]
}) {
  const pathname = usePathname()
  if (/^\/attendance\/[^/]+$/.test(pathname)) return null
  return <MobileTabBar pathname={pathname} {...props} />
}
