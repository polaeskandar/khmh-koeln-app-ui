import { Suspense } from "react"
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
import { getShellData } from "@/server/request"

import { ActiveMobileTabBar, MobileTabBar } from "./mobile-tab-bar"
import {
  ActiveSidebarNav,
  NavUser,
  NavUserSkeleton,
  SidebarBrand,
  SidebarNav,
} from "./sidebar-parts"

/**
 * The application frame. The signed-in person, the active page and the
 * open-session badge stream in; the navigation shows right away. In Arabic the
 * sidebar sits on the right, where reading starts.
 */
async function SidebarDynamic() {
  const shell = await getShellData()
  return (
    <>
      <SidebarContent>
        <ActiveSidebarNav openSessions={shell.openSessions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser viewer={shell.viewer} personas={shell.personas} />
      </SidebarFooter>
    </>
  )
}

function SidebarFallback() {
  return (
    <>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter>
        <NavUserSkeleton />
      </SidebarFooter>
    </>
  )
}

async function MobileTabBarDynamic() {
  const shell = await getShellData()
  return (
    <ActiveMobileTabBar
      openSessions={shell.openSessions}
      viewer={shell.viewer}
      personas={shell.personas}
    />
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const dir = directionOf(useLocale())
  return (
    <SidebarProvider className="min-h-svh">
      <Sidebar collapsible="icon" side={dir === "rtl" ? "right" : "left"} dir={dir}>
        <SidebarHeader>
          <SidebarBrand />
        </SidebarHeader>
        <Suspense fallback={<SidebarFallback />}>
          <SidebarDynamic />
        </Suspense>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 pb-20 md:pb-0">{children}</SidebarInset>
      <Suspense fallback={<MobileTabBar />}>
        <MobileTabBarDynamic />
      </Suspense>
    </SidebarProvider>
  )
}
