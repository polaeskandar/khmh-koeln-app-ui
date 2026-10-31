import { Suspense } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { DemoDataBadge } from "@/components/app-shell/topbar"
import { KhmkMark } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { getShellData } from "@/server/request"

import { MemberAccountMenu } from "./member-account-menu"
import {
  ActiveMemberDesktopNav,
  ActiveMemberTabBar,
  MemberDesktopNav,
  MemberTabBar,
} from "./member-nav"

async function AccountMenu() {
  const shell = await getShellData()
  return <MemberAccountMenu viewer={shell.viewer} personas={shell.personas} />
}

/**
 * The member portal frame, built like the parent portal: mobile first, a
 * bottom tab bar on phones and a simple top navigation on larger screens.
 * Nothing of the staff application is part of it.
 */
export function MemberShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("member.brand")
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <Link href="/member" className="flex items-center gap-2.5">
            <KhmkMark className="size-7" />
            <span className="flex flex-col leading-none whitespace-nowrap">
              <span className="font-heading text-[15px] font-semibold tracking-tight">
                KHMK Köln
              </span>
              <span className="text-[11px] text-muted-foreground">{t("forMembers")}</span>
            </span>
          </Link>
          <div className="ms-4 hidden self-stretch md:flex">
            <Suspense fallback={<MemberDesktopNav />}>
              <ActiveMemberDesktopNav />
            </Suspense>
          </div>
          <div className="ms-auto flex items-center gap-2">
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
      <Suspense fallback={<MemberTabBar />}>
        <ActiveMemberTabBar />
      </Suspense>
    </div>
  )
}
