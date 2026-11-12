import { useLocale } from "next-intl"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { directionOf } from "@/i18n/config"
import type { Shell } from "@/server/queries/shell"

import { MobileTabBar } from "./mobile-tab-bar"
import { NavUser, SidebarBrand, SidebarNav } from "./sidebar-parts"

export function AppShell({ shell, children }: { shell: Shell; children: React.ReactNode }) {
  const dir = directionOf(useLocale())

  return (
    <SidebarProvider className="min-h-svh">
      <Sidebar collapsible="icon" side={dir === "rtl" ? "right" : "left"} dir={dir}>
        <SidebarHeader>
          <SidebarBrand />
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav nav={shell.nav} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser viewer={shell.viewer} personas={shell.personas} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 pb-20 md:pb-0">{children}</SidebarInset>
      <MobileTabBar nav={shell.nav} viewer={shell.viewer} personas={shell.personas} />
    </SidebarProvider>
  )
}
