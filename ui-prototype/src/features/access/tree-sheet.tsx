"use client"

import { useState } from "react"
import { FolderTree } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useInlineStart } from "@/i18n/direction"

import { AccessTree, type TreeProps } from "./access-tree"

/** On phones the tree opens in a sheet, so the selected place gets the whole screen. */
export function TreeSheet(props: TreeProps) {
  const t = useTranslations("access.tree")
  const side = useInlineStart()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" className="w-full lg:hidden" onClick={() => setOpen(true)}>
        <FolderTree data-icon="inline-start" />
        {t("browse")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="w-[88vw] gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("browse")}</SheetTitle>
            <SheetDescription>{t("browseHint")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <AccessTree {...props} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
