"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenText, House, ListChecks, Settings, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { PersonaMenuContent } from "@/components/app-shell/sidebar-parts"
import { KhmkMark } from "@/components/brand/logo"
import { MemberAvatar } from "@/components/member-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ViewerInfo } from "@/lib/view-models"

type Item = { href: string; key: "home" | "lessons" | "tasks" | "settings"; icon: LucideIcon }

const ICONS: Record<Item["key"], LucideIcon> = {
  home: House,
  lessons: BookOpenText,
  tasks: ListChecks,
  settings: Settings,
}

function useItems(base: "/parent" | "/member"): Item[] {
  return (["home", "lessons", "tasks", "settings"] as const).map((key) => ({
    key,
    href: key === "home" ? base : `${base}/${key}`,
    icon: ICONS[key],
  }))
}

function active(href: string, base: string, pathname: string) {
  return href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalShell({
  base,
  viewer,
  personas,
  title,
  children,
}: {
  base: "/parent" | "/member"
  viewer: ViewerInfo
  personas: ViewerInfo[]
  title: string
  children: React.ReactNode
}) {
  const t = useTranslations("portal.nav")
  const tshell = useTranslations("shell")
  const pathname = usePathname() ?? base
  const items = useItems(base)

  return (
    <div className="flex min-h-svh flex-col bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link href={base} className="flex items-center gap-2">
            <KhmkMark className="size-7" />
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-sm font-semibold">KHMK Köln</span>
              <span className="text-[11px] text-muted-foreground">{title}</span>
            </span>
          </Link>
          <nav aria-label={t("label")} className="ms-6 hidden gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active(item.href, base, pathname) ? "page" : undefined}
                className={cn(
                  "px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                  active(item.href, base, pathname) &&
                    "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-[18px]"
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto"
                aria-label={tshell("accountMenu")}
              >
                <MemberAvatar name={viewer.name} initials={viewer.initials} seed={viewer.id} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <PersonaMenuContent
                viewer={viewer}
                personas={personas}
                settingsHref={`${base}/settings`}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-6 md:py-10">
        {children}
      </main>
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active(item.href, base, pathname) ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              active(item.href, base, pathname) &&
                "text-foreground after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:bg-primary"
            )}
          >
            <item.icon className="size-5" />
            {t(item.key)}
          </Link>
        ))}
      </nav>
    </div>
  )
}
