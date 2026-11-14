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

import { ResourceExplorer } from "./resource-explorer"

/** On phones the explorer opens in a sheet, so the selected place gets the whole screen. */
export function ExplorerSheet(props: React.ComponentProps<typeof ResourceExplorer>) {
  const t = useTranslations("access.explorer")
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
            <SheetTitle>{t("label")}</SheetTitle>
            <SheetDescription>{t("sheetHint")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <ResourceExplorer {...props} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
