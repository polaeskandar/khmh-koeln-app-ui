import type { Metadata, Viewport } from "next"
import { Geist, Noto_Kufi_Arabic, Oxanium } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { cn } from "cn"

import { Providers } from "@/components/providers"
import { directionOf } from "@/i18n/config"

import "./globals.css"

// Preset b3a10z1gt0: Oxanium for text, Geist for headings (self-hosted by next/font at build time).
const fontText = Oxanium({ subsets: ["latin", "latin-ext"], variable: "--font-oxanium" })
const fontHeading = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist" })
// Arabic letters: a Kufi face whose square forms match Oxanium. It comes after
// the preset's fonts in the font stack, so it only draws Arabic (see globals.css);
// only its Arabic subset is preloaded.
const fontArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  adjustFontFallback: false,
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta")
  return {
    title: { default: "KHMK Köln", template: "%s · KHMK Köln" },
    description: t("description"),
    robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  const dir = directionOf(locale)
  return (
    <html
      lang={locale}
      dir={dir}
      // next-themes sets the light/dark class before the first paint.
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontText.variable,
        fontHeading.variable,
        fontArabic.variable,
        "font-sans"
      )}
    >
      <body className="min-h-svh bg-background">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
