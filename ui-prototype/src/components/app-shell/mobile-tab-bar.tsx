"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenText,
  ClipboardCheck,
  Database,
  House,
  Layers,
  ListChecks,
  Menu,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
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
import type { Shell } from "@/server/queries/shell"

import { isActive, PersonaMenuContent } from "./sidebar-parts"

function Tab({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
        active &&
          "text-foreground after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:bg-primary"
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  )
}

export function MobileTabBar({
  nav,
  viewer,
  personas,
}: {
  nav: Shell["nav"]
  viewer: ViewerInfo
  personas: ViewerInfo[]
}) {
  const t = useTranslations("nav")
  const pathname = usePathname() ?? ""

  if (/^\/attendance\/[^/]+$/.test(pathname)) {
    return null
  }

  const lessonsHref = nav.preparation ? "/lessons" : "/lessons/tasks"
  const more = [
    nav.accounts && { href: "/admin/accounts", icon: UsersRound, label: t("accounts") },
    nav.access && { href: "/admin/access", icon: ShieldCheck, label: t("access") },
    nav.data && { href: "/admin/data", icon: Database, label: t("data") },
    nav.preparation && nav.tasks && { href: "/lessons/tasks", icon: ListChecks, label: t("tasks") },
  ].filter((x) => !!x)

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <Tab href="/" icon={House} label={t("home")} active={pathname === "/"} />
      <Tab
        href="/services"
        icon={Layers}
        label={t("services")}
        active={isActive("/services", pathname)}
      />
      {nav.preparation || nav.tasks ? (
        <Tab
          href={lessonsHref}
          icon={BookOpenText}
          label={t("lessons")}
          active={isActive("/lessons", pathname)}
        />
      ) : null}
      {nav.attendance ? (
        <Tab
          href="/attendance"
          icon={ClipboardCheck}
          label={t("attendance")}
          active={isActive("/attendance", pathname)}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground outline-none",
            (isActive("/admin", pathname) || isActive("/settings", pathname)) && "text-foreground"
          )}
        >
          <Menu className="size-5" />
          {t("more")}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" side="top" align="end">
          {more.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <item.icon />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
          {more.length > 0 ? <DropdownMenuSeparator /> : null}
          <PersonaMenuContent viewer={viewer} personas={personas} settingsHref="/settings" />
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
