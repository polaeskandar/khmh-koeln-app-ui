"use client"

import { ThemeProvider } from "next-themes"
import { Direction } from "radix-ui"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Light or dark follows the device unless the person picks one (kept per
 * browser by next-themes). Radix components read the page direction from here,
 * so menus, tabs and keyboard navigation run right to left in Arabic.
 */
export function Providers({ dir, children }: { dir: "ltr" | "rtl"; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Direction.Provider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" dir={dir} />
        </TooltipProvider>
      </Direction.Provider>
    </ThemeProvider>
  )
}
