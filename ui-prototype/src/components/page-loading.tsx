import { useTranslations } from "next-intl"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * The loading state of a staff page: top bar, title and content placeholders.
 * Every route folder that reads its URL (params or search params) has a
 * loading.tsx with this, so client navigations show it at once instead of
 * waiting for the server.
 */
export function PageLoading() {
  const t = useTranslations("common")
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
        <span className="sr-only">{t("loadingEllipsis")}</span>
      </div>
    </div>
  )
}

/** The parent portal's loading state, inside its own frame. */
export function ParentPageLoading() {
  const t = useTranslations("common")
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="flex gap-3">
        <Skeleton className="h-14 w-44" />
        <Skeleton className="h-14 w-44" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <span className="sr-only">{t("loadingEllipsis")}</span>
    </div>
  )
}
