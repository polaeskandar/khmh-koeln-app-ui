import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Layers,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

export type NavKey = "dashboard" | "services" | "meetings" | "attendance" | "members" | "settings"
export type NavItem = { href: string; key: NavKey; icon: LucideIcon }

/**
 * The MVP navigation agreed with the board. Nothing else is listed, not even
 * as a placeholder. Labels are the "nav.<key>" messages.
 */
export const NAV: NavItem[] = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/services", key: "services", icon: Layers },
  { href: "/meetings", key: "meetings", icon: CalendarDays },
  { href: "/attendance", key: "attendance", icon: ClipboardCheck },
  { href: "/members", key: "members", icon: UsersRound },
]

export const SETTINGS: NavItem = { href: "/settings", key: "settings", icon: Settings }

export function isActive(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
