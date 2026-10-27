"use client"

/**
 * Sidebar pieces adapted from the shadcnblocks Pro block "application-shell30"
 * (sidebar on desktop, tab bar on mobile). Kept: icon-collapsible sidebar,
 * primary action under the brand, settings pinned to the bottom, user menu in
 * the footer. Changed: the church navigation, Next.js links, the open-session
 * badge and the prototype's "View as" persona switch.
 */
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  ChevronsUpDown,
  CircleUserRound,
  ClipboardCheck,
  FlaskConical,
  House,
  LogOut,
  RotateCcw,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { KhmkMark } from "@/components/brand/logo"
import { MemberAvatar } from "@/components/member-avatar"
import { PreferencesSubmenus } from "@/components/preferences-menu"
import { LiveDot } from "@/components/status"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useInlineEnd } from "@/i18n/direction"
import type { ViewerInfo } from "@/lib/view-models"
import { signOutAction } from "@/server/actions/auth"
import { resetDemoDataAction, switchPersonaAction } from "@/server/actions/prototype"

import { isActive, NAV, SETTINGS } from "./nav"

export function SidebarBrand() {
  const t = useTranslations()
  // Tooltips and menus of the sidebar open towards the page, whichever side the sidebar is on.
  const side = useInlineEnd()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
          <Link href="/">
            <KhmkMark />
            <div className="grid flex-1 text-start leading-tight">
              <span className="truncate font-heading text-[15px] font-semibold tracking-tight">
                KHMK Köln
              </span>
              <span className="truncate text-xs text-muted-foreground">{t("brand.church")}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={{ children: t("nav.takeAttendance"), side }}
          className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
        >
          <Link href="/attendance">
            <ClipboardCheck />
            <span className="font-semibold">{t("nav.takeAttendance")}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function SidebarNav({
  pathname,
  openSessions = 0,
}: {
  pathname?: string | null
  openSessions?: number
}) {
  const t = useTranslations("nav")
  const side = useInlineEnd()
  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {NAV.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={{ children: t(item.key), side }}
                  isActive={isActive(item.href, pathname)}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{t(item.key)}</span>
                  </Link>
                </SidebarMenuButton>
                {item.href === "/attendance" && openSessions > 0 ? (
                  <SidebarMenuBadge className="gap-1.5 text-success">
                    <LiveDot className="size-1.5" />
                    {t("openSessions", { count: openSessions })}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="mt-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={{ children: t(SETTINGS.key), side }}
                isActive={isActive(SETTINGS.href, pathname)}
              >
                <Link href={SETTINGS.href}>
                  <SETTINGS.icon />
                  <span>{t(SETTINGS.key)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

/** The navigation with the current page highlighted (needs the URL, so it renders at request time). */
export function ActiveSidebarNav({ openSessions }: { openSessions?: number }) {
  const pathname = usePathname()
  return <SidebarNav pathname={pathname} openSessions={openSessions} />
}

/** Static placeholder for the user menu (the shadcn menu skeleton uses a random width, which cannot be prerendered). */
export function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 items-center gap-2 px-2" aria-hidden="true">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** Prototype persona switch and demo-data reset. Disappears once real sign-in exists. */
export function PersonaMenuContent({
  viewer,
  personas,
}: {
  viewer: ViewerInfo
  personas: ViewerInfo[]
}) {
  const t = useTranslations("shell")
  const [, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const inPortal = pathname.startsWith("/parent")
  return (
    <>
      {/* The parent portal's menu has its own link to the account page. */}
      {inPortal ? null : (
        <DropdownMenuItem asChild>
          <Link href="/account">
            <CircleUserRound />
            {t("yourAccount")}
          </Link>
        </DropdownMenuItem>
      )}
      <PreferencesSubmenus />
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal tracking-normal text-muted-foreground normal-case">
        <FlaskConical className="size-3.5" />
        {t("prototypeViewAs")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={viewer.id}
        onValueChange={(id) =>
          startTransition(async () => {
            await switchPersonaAction(id)
            const next = personas.find((p) => p.id === id)
            if (!next) return
            toast.success(t("nowViewingAs", { name: next.name, role: next.roleSummary }))
            // Parents only have the portal; staff who are not parents only have the staff app.
            if (!next.isStaff && !inPortal) router.push("/parent")
            else if (!next.isParent && inPortal) router.push("/")
          })
        }
      >
        <DropdownMenuGroup className="max-h-80 overflow-y-auto">
          {personas.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="py-1.5">
              <div className="grid leading-tight">
                <span className="truncate">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">{p.roleSummary}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      {viewer.isStaff && viewer.isParent ? (
        <DropdownMenuItem asChild>
          <Link href={inPortal ? "/" : "/parent"}>
            <House />
            {inPortal ? t("openStaffApp") : t("openParentPortal")}
          </Link>
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={() => startTransition(() => signOutAction())}>
        <LogOut />
        {t("signOut")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() =>
          startTransition(async () => {
            await resetDemoDataAction()
            toast.success(t("demoDataReset"))
          })
        }
      >
        <RotateCcw />
        {t("resetDemoData")}
      </DropdownMenuItem>
    </>
  )
}

export function NavUser({ viewer, personas }: { viewer: ViewerInfo; personas: ViewerInfo[] }) {
  const side = useInlineEnd()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <MemberAvatar name={viewer.name} initials={viewer.initials} seed={viewer.id} />
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{viewer.name}</span>
                <span className="truncate text-xs text-muted-foreground">{viewer.roleSummary}</span>
              </div>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" side={side} align="end">
            <PersonaMenuContent viewer={viewer} personas={personas} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
