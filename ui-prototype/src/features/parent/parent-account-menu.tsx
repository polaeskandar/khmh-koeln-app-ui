"use client"

import Link from "next/link"
import { UserRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { PersonaMenuContent } from "@/components/app-shell/sidebar-parts"
import { MemberAvatar } from "@/components/member-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ViewerInfo } from "@/lib/view-models"

export function ParentAccountMenu({
  viewer,
  personas,
}: {
  viewer: ViewerInfo
  personas: ViewerInfo[]
}) {
  const t = useTranslations("parent")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label={t("menu.accountOf", { name: viewer.name })}
        >
          <MemberAvatar
            name={viewer.name}
            initials={viewer.initials}
            seed={viewer.id}
            className="size-7"
          />
          <span className="hidden max-w-40 truncate text-sm font-medium tracking-normal normal-case sm:inline md:hidden lg:inline">
            {viewer.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="grid leading-tight">
          <span className="truncate">{viewer.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{viewer.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/parent/account">
            <UserRound />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Starts with the language and appearance submenus (PreferencesSubmenus), as in the staff menus. */}
        <PersonaMenuContent viewer={viewer} personas={personas} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
