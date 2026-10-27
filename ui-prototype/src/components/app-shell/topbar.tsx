import { Fragment, Suspense } from "react"
import Link from "next/link"
import { connection } from "next/server"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { KhmkMark } from "@/components/brand/logo"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getFormat } from "@/i18n/server"
import { localDateOf, localTimeOf } from "@/lib/domain/time"
import { nowMs } from "@/server/mock/clock"

export type Crumb = { label: string; href?: string }

/** Today in the church's time zone, with the Coptic date. Runs on the prototype's demo clock. */
async function TodayStamp() {
  await connection()
  const f = await getFormat()
  const ms = nowMs()
  const date = localDateOf(ms)
  return (
    <div className="hidden flex-col items-end leading-tight lg:flex">
      <span className="text-sm font-medium tabular-nums">
        {f.dayMonth(date)} · {localTimeOf(ms)}
      </span>
      <span className="text-xs text-muted-foreground">{f.copticDate(date)}</span>
    </div>
  )
}

export function DemoDataBadge() {
  const t = useTranslations("shell")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="hidden h-6 items-center gap-1.5 border border-dashed px-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase md:inline-flex"
        >
          <FlaskConical className="size-3.5" aria-hidden="true" />
          {t("demoData")}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {t("demoDataHint")}
      </TooltipContent>
    </Tooltip>
  )
}

export function Topbar({ crumbs, actions }: { crumbs: Crumb[]; actions?: React.ReactNode }) {
  const t = useTranslations("nav")
  const current = crumbs.at(-1)
  const parent = crumbs.length > 1 ? crumbs.at(-2) : undefined
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ms-1.5 hidden md:inline-flex" />
      <Separator
        orientation="vertical"
        className="me-1 hidden md:block data-vertical:h-4 data-vertical:self-auto"
      />
      {parent?.href ? (
        <Link
          href={parent.href}
          className="-ms-1 flex size-9 shrink-0 items-center justify-center md:hidden"
          aria-label={t("backTo", { page: parent.label })}
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : (
        <KhmkMark className="size-7 md:hidden" />
      )}
      <span className="min-w-0 truncate font-heading font-semibold md:hidden">
        {current?.label}
      </span>
      <Breadcrumb className="hidden min-w-0 md:block" aria-label={t("breadcrumb")}>
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {i === crumbs.length - 1 || !c.href ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate">
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ms-auto flex shrink-0 items-center gap-3">
        {actions}
        <DemoDataBadge />
        <Suspense fallback={null}>
          <TodayStamp />
        </Suspense>
      </div>
    </header>
  )
}

/** Page body: consistent gutters and the readable maximum width. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 py-6 md:px-8 md:py-8",
        className
      )}
    >
      {children}
    </div>
  )
}
