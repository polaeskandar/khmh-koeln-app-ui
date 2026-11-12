"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  BookOpenText,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  ClipboardCheck,
  Database,
  FlaskConical,
  GraduationCap,
  House,
  KeyRound,
  Layers,
  ListChecks,
  LogOut,
  Network,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sprout,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { cn } from "cn"

import { KhmkMark } from "@/components/brand/logo"
import { MemberAvatar } from "@/components/member-avatar"
import { PreferencesSubmenus } from "@/components/preferences-menu"
import { ServiceSwatch } from "@/components/service-tag"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useDirection, useInlineEnd } from "@/i18n/direction"
import type { ViewerInfo } from "@/lib/view-models"
import { signOutAction } from "@/server/actions/auth"
import { resetDemoDataAction, switchPersonaAction } from "@/server/actions/prototype"
import type { Shell } from "@/server/queries/shell"

export function isActive(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false
  }

  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarBrand() {
  const t = useTranslations()

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
    </SidebarMenu>
  )
}

function Item({
  href,
  icon: Icon,
  label,
  pathname,
  exact,
}: {
  href: string
  icon: LucideIcon
  label: string
  pathname: string
  exact?: boolean
}) {
  const side = useInlineEnd()
  const active = exact ? pathname === href : isActive(href, pathname)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={{ children: label, side }} isActive={active}>
        <Link href={href} aria-current={active ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  const rtl = useDirection() === "rtl"

  return (
    <ChevronDown
      aria-hidden="true"
      className={cn("transition-transform", className)}
      style={{ transform: open ? "none" : `rotate(${rtl ? 90 : -90}deg)` }}
    />
  )
}

type SubLink = { href: string; icon: LucideIcon; label: string; exact?: boolean }

function SubItem({
  item,
  pathname,
  children,
}: {
  item: SubLink
  pathname: string
  children?: React.ReactNode
}) {
  const active = item.exact ? pathname === item.href : isActive(item.href, pathname)

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link href={item.href} aria-current={active ? "page" : undefined}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuSubButton>
      {children}
    </SidebarMenuSubItem>
  )
}

function Section({
  label,
  icon: Icon,
  items,
  pathname,
  href = items[0]?.href ?? "/",
  children,
}: {
  label: string
  icon: LucideIcon
  items: SubLink[]
  pathname: string
  href?: string
  children?: React.ReactNode
}) {
  const side = useInlineEnd()
  const { state } = useSidebar()
  const [open, setOpen] = useState(true)
  const active = isActive(href, pathname) || items.some((item) => isActive(item.href, pathname))

  if (state === "collapsed") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={{ children: label, side }} isActive={active}>
          <Link href={href}>
            <Icon />
            <span>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={{ children: label, side }} aria-expanded={open}>
            <Icon />
            <span>{label}</span>
            <Chevron open={open} className="ms-auto size-4 text-sidebar-foreground/60" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SubItem key={item.href} item={item} pathname={pathname} />
            ))}
            {children}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function ServicesItem({
  services,
  pathname,
}: {
  services: Shell["nav"]["services"]
  pathname: string
}) {
  const t = useTranslations("nav")
  const [open, setOpen] = useState(pathname.startsWith("/services") || services.length <= 6)

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          isActive={pathname === "/services" || pathname === "/services/calendar"}
        >
          <Link href="/services">
            <Layers />
            <span>{t("services")}</span>
          </Link>
        </SidebarMenuSubButton>
        {services.length > 0 ? (
          <>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={t("showServices")}
                aria-expanded={open}
                className="absolute end-1 top-1.5 flex size-5 items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                <Chevron open={open} className="size-4" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="me-0 mt-1">
                {services.map((x) => {
                  const href = `/services/${x.id}`
                  const active = isActive(href, pathname)

                  return (
                    <SidebarMenuSubItem key={x.id}>
                      <SidebarMenuSubButton asChild size="sm" isActive={active}>
                        <Link href={href} aria-current={active ? "page" : undefined}>
                          <ServiceSwatch tone={x.tone} />
                          <span>{x.name}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        ) : null}
      </SidebarMenuSubItem>
    </Collapsible>
  )
}

export function SidebarNav({ nav }: { nav: Shell["nav"] }) {
  const t = useTranslations("nav")
  const pathname = usePathname() ?? ""
  const adminItems: SubLink[] = [
    nav.accounts && { href: "/admin/accounts", icon: UsersRound, label: t("accounts") },
    nav.access && { href: "/admin/access", icon: ShieldCheck, label: t("access") },
    nav.data && { href: "/admin/data", icon: Database, label: t("data") },
  ].filter((x) => !!x)
  const lessonItems: SubLink[] = [
    nav.preparation && {
      href: "/lessons",
      icon: BookOpenText,
      label: t("preparation"),
      exact: true,
    },
    nav.tasks && { href: "/lessons/tasks", icon: ListChecks, label: t("tasks") },
  ].filter((x) => !!x)

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <Item href="/" icon={House} label={t("home")} pathname={pathname} exact />
            {adminItems.length > 0 ? (
              <Section
                label={t("administration")}
                icon={Building2}
                items={adminItems}
                pathname={pathname}
              />
            ) : null}
            <Section
              label={t("organization")}
              icon={Network}
              items={[]}
              href="/services"
              pathname={pathname}
            >
              <ServicesItem services={nav.services} pathname={pathname} />
            </Section>
            {lessonItems.length > 0 ? (
              <Section
                label={t("lessons")}
                icon={GraduationCap}
                items={lessonItems}
                pathname={pathname}
              />
            ) : null}
            {nav.attendance ? (
              <Item
                href="/attendance"
                icon={ClipboardCheck}
                label={t("attendance")}
                pathname={pathname}
              />
            ) : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="mt-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <Item href="/settings" icon={Settings} label={t("settings")} pathname={pathname} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

export function homeOfPersona(p: ViewerInfo) {
  if (p.areas.staff) {
    return "/"
  }

  return p.areas.parent ? "/parent" : "/member"
}

export function PersonaMenuContent({
  viewer,
  personas,
  settingsHref,
}: {
  viewer: ViewerInfo
  personas: ViewerInfo[]
  settingsHref: string
}) {
  const t = useTranslations("shell")
  const [, startTransition] = useTransition()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const area = pathname.startsWith("/parent")
    ? "parent"
    : pathname.startsWith("/member")
      ? "member"
      : "staff"
  const otherAreas = [
    area !== "staff" && viewer.areas.staff
      ? { href: "/", label: t("openStaffApp"), icon: House }
      : null,
    area !== "parent" && viewer.areas.parent
      ? { href: "/parent", label: t("openParentPortal"), icon: Sprout }
      : null,
    area !== "member" && viewer.areas.member
      ? { href: "/member", label: t("openMemberPortal"), icon: BookOpenText }
      : null,
  ].filter((x) => x !== null)

  return (
    <>
      <DropdownMenuLabel className="grid text-xs font-normal tracking-normal normal-case">
        <span className="truncate font-medium text-foreground">{viewer.name}</span>
        <span className="truncate text-muted-foreground" dir="ltr">
          {viewer.username}
        </span>
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href={settingsHref}>
          <KeyRound />
          {t("settings")}
        </Link>
      </DropdownMenuItem>
      <PreferencesSubmenus />
      {otherAreas.map((a) => (
        <DropdownMenuItem key={a.href} asChild>
          <Link href={a.href}>
            <a.icon />
            {a.label}
          </Link>
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onSelect={() => startTransition(() => signOutAction())}>
        <LogOut />
        {t("signOut")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal tracking-normal text-muted-foreground normal-case">
        <FlaskConical className="size-3.5" />
        {t("prototypeViewAs")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={viewer.id}
        onValueChange={(id) =>
          startTransition(async () => {
            const target = await switchPersonaAction(id)
            const next = personas.find((p) => p.id === id)

            if (!next || !target) {
              return
            }

            toast.success(t("nowViewingAs", { name: next.name }))
            router.push(target)
          })
        }
      >
        <DropdownMenuGroup className="max-h-72 overflow-y-auto">
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
      <DropdownMenuItem
        onSelect={() =>
          startTransition(async () => {
            await resetDemoDataAction("church")
            toast.success(t("demoDataReset"))
            router.push("/")
          })
        }
      >
        <RotateCcw />
        {t("resetDemoData")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() =>
          startTransition(async () => {
            await resetDemoDataAction("empty")
            toast.success(t("emptyChurchStarted"))
            router.push("/")
          })
        }
      >
        <Sprout />
        {t("startEmptyChurch")}
      </DropdownMenuItem>
    </>
  )
}

export function NavUser({ viewer, personas }: { viewer: ViewerInfo; personas: ViewerInfo[] }) {
  const side = useInlineEnd()
  const t = useTranslations("shell")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t("accountMenu")}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <MemberAvatar name={viewer.name} initials={viewer.initials} seed={viewer.id} />
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{viewer.name}</span>
                <span className="truncate text-xs text-muted-foreground">{viewer.roleSummary}</span>
              </div>
              <ChevronsUpDown className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" side={side} align="end">
            <PersonaMenuContent viewer={viewer} personas={personas} settingsHref="/settings" />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
