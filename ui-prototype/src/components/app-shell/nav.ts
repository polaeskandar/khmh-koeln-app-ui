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

/**
 * May the account use this item? Every staff account sees the services and meetings; members and
 * attendance depend on its roles. Without permissions (the static fallback) everything shows.
 * Settings stays for everyone in the prototype, for its demo controls; the app shows it to roles
 * that may see accounts or roles, or handle data protection requests.
 */
export function navAllowed(key: NavKey, permissions?: readonly string[]): boolean {
  if (!permissions) return true
  if (key === "members") return permissions.includes("members:read")
  if (key === "attendance") {
    return permissions.includes("attendance:read") || permissions.includes("attendance:create")
  }
  return true
}

export function isActive(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
