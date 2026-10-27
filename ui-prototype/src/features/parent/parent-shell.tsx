import { Suspense } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { DemoDataBadge } from "@/components/app-shell/topbar"
import { KhmkMark } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { getShellData } from "@/server/request"

import { ParentAccountMenu } from "./parent-account-menu"
import {
  ActiveParentDesktopNav,
  ActiveParentTabBar,
  ParentDesktopNav,
  ParentTabBar,
} from "./parent-nav"

async function AccountMenu() {
  const shell = await getShellData()
  return <ParentAccountMenu viewer={shell.viewer} personas={shell.personas} />
}

/**
 * The parent portal frame: mobile first, a bottom tab bar on phones and a
 * simple top navigation on larger screens. Nothing of the staff application
 * (sidebar, services, attendance) is part of it.
 */
export function ParentShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("parent.brand")
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <Link href="/parent" className="flex items-center gap-2.5">
            <KhmkMark className="size-7" />
            <span className="flex flex-col leading-none whitespace-nowrap">
              <span className="font-heading text-[15px] font-semibold tracking-tight">
                KHMK Köln
              </span>
              <span className="text-[11px] text-muted-foreground">{t("forParents")}</span>
            </span>
          </Link>
          <div className="ms-4 hidden self-stretch md:flex">
            <Suspense fallback={<ParentDesktopNav />}>
              <ActiveParentDesktopNav />
            </Suspense>
          </div>
          <div className="ms-auto flex items-center gap-2">
            {/* Next to the four German or Arabic menu items there is only room for it on wide screens. */}
            <div className="hidden lg:flex">
              <DemoDataBadge />
            </div>
            <Suspense fallback={<Skeleton className="size-9" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-24 md:px-6 md:pt-10 md:pb-12">
        {children}
      </main>
      <Suspense fallback={<ParentTabBar />}>
        <ActiveParentTabBar />
      </Suspense>
    </div>
  )
}
