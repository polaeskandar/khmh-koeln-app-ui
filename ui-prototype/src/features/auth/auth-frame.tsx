import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { KhmkMark } from "@/components/brand/logo"
import { PreferencesBar } from "@/components/preferences-menu"

/**
 * The frame of the pages before sign-in: the church's mark, language and
 * appearance, the page, and a quieter side column on wide screens.
 */
export function AuthFrame({
  children,
  aside,
  className,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  const t = useTranslations()
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-5 md:px-8">
        <Link
          href="/sign-in"
          className="flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <KhmkMark className="size-9" />
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-lg font-semibold tracking-tight">KHMK Köln</span>
            <span className="text-xs text-muted-foreground">{t("brand.church")}</span>
          </span>
        </Link>
        <PreferencesBar />
      </header>
      <main
        className={cn(
          "mx-auto grid w-full max-w-5xl flex-1 content-start gap-10 px-4 pt-10 pb-14 md:gap-16 md:px-8 md:pt-16",
          aside && "md:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]",
          className
        )}
      >
        <div className="flex min-w-0 flex-col gap-7">{children}</div>
        {aside ? (
          <aside className="flex min-w-0 flex-col gap-6 border-t pt-8 text-sm md:border-s md:border-t-0 md:ps-10 md:pt-1">
            {aside}
          </aside>
        ) : null}
      </main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-5 text-xs text-muted-foreground md:px-8">
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("auth.footer.privacy")}
        </Link>
        <span>{t("auth.footer.prototype")}</span>
      </footer>
    </div>
  )
}

/** The heading block of an auth page. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  )
}
