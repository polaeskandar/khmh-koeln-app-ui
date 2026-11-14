import { notFound } from "next/navigation"
import { MapPinOff } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { PageHeader } from "@/components/page-header"
import { ExplorerSheet } from "@/features/access/explorer-sheet"
import { ParentalAccess } from "@/features/access/parental-access"
import { ResourceExplorer } from "@/features/access/resource-explorer"
import { ResourcePanel } from "@/features/access/resource-panel"
import { RoleDetailView, RoleList } from "@/features/access/roles-view"
import { parseRefKey } from "@/lib/domain/resources"
import {
  accessTabs,
  explorerStart,
  getResourceAccess,
  getRoles,
  managedPlaces,
} from "@/server/queries/access"
import { getParentalAccess } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"
import type { Context } from "@/server/viewer"

type Tab = "resources" | "roles" | "parents"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("access") }
}

async function Resources({ ctx, r }: { ctx: Context; r: unknown }) {
  const t = await getTranslations("access")
  const asked = parseRefKey(r)
  const access = asked ? getResourceAccess(ctx, asked) : null
  const start = explorerStart(ctx, access ? asked : null)
  const focus = access ? asked : parseRefKey(start.focus)
  const data = access ?? (asked ? null : focus ? getResourceAccess(ctx, focus) : null)
  const places = managedPlaces(ctx)
  const explorer = {
    root: start.root,
    pages: start.pages,
    expanded: start.expanded,
    selected: data ? start.focus : null,
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
        <ExplorerSheet {...explorer} />
        <ResourceExplorer {...explorer} className="hidden lg:flex" />
        {places ? (
          <p className="hidden text-xs text-muted-foreground lg:block">
            {t("explorer.boundary", { places })}
          </p>
        ) : null}
      </aside>
      {data ? (
        <ResourcePanel data={data} />
      ) : (
        <div className="flex flex-col items-center gap-3 border border-dashed bg-card p-10 text-center">
          <MapPinOff className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">{t("panel.outside")}</p>
          {places ? (
            <p className="max-w-[48ch] text-sm text-muted-foreground">
              {t("panel.outsideHint", { places })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const query = await searchParams
  const ctx = await getStaffContext()
  const can = accessTabs(ctx.state, ctx.viewer)
  const tabs: Tab[] = [
    ...(can.resources ? (["resources"] as const) : []),
    ...(can.roles ? (["roles"] as const) : []),
    ...(can.guardians ? (["parents"] as const) : []),
  ]

  if (tabs.length === 0) {
    notFound()
  }

  const tab: Tab = tabs.includes(query.tab as Tab) ? (query.tab as Tab) : tabs[0]
  const t = await getTranslations("access")
  const tn = await getTranslations("nav")
  const roles = tab === "roles" ? getRoles(ctx, query.role as string | undefined) : null

  return (
    <>
      <Topbar crumbs={[{ label: tn("administration") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t(`tabHints.${tab}`)} />
        {tabs.length > 1 ? (
          <LinkTabs
            label={t("title")}
            active={tab}
            items={tabs.map((x) => ({
              key: x,
              href: `/admin/access?tab=${x}`,
              label: t(`tabs.${x}`),
            }))}
          />
        ) : null}
        {tab === "resources" ? <Resources ctx={ctx} r={query.r} /> : null}
        {roles ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
            <RoleList
              roles={roles.roles}
              selectedId={roles.selected?.id ?? null}
              canCreate={roles.canCreate}
            />
            {roles.selected ? <RoleDetailView role={roles.selected} /> : null}
          </div>
        ) : null}
        {tab === "parents" ? <ParentalAccess data={getParentalAccess(ctx)} /> : null}
      </PageBody>
    </>
  )
}
