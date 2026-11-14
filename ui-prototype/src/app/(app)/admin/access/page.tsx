import { notFound } from "next/navigation"
import { MapPinOff } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader } from "@/components/page-header"
import { AccessPanel } from "@/features/access/access-panel"
import { AccessTree } from "@/features/access/access-tree"
import { TreeSheet } from "@/features/access/tree-sheet"
import { isResourceType, parseRefKey } from "@/lib/domain/resources"
import { getAccessView, managedPlaces, opensAccess, treeStart } from "@/server/queries/access"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("access") }
}

/**
 * Administration › Access: the church as a tree on the left; on the right, who has access to the
 * selected place, with what, and whether it was given there or above.
 */
export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const query = await searchParams
  const ctx = await getStaffContext()

  if (!opensAccess(ctx.state, ctx.viewer)) {
    notFound()
  }

  const asked = parseRefKey(query.r)
  const type = typeof query.type === "string" && isResourceType(query.type) ? query.type : null
  const view = asked ? getAccessView(ctx, asked, type) : null
  const start = treeStart(ctx, view ? asked : null, view ? type : null)
  const shown = view ?? (asked ? null : getAccessView(ctx, start.focus, null))
  const places = managedPlaces(ctx)
  const tree = {
    root: start.root,
    pages: start.pages,
    expanded: start.expanded,
    selected: shown ? start.selected : "",
  }
  const t = await getTranslations("access")
  const tn = await getTranslations("nav")

  return (
    <>
      <Topbar crumbs={[{ label: tn("administration") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
            <TreeSheet {...tree} />
            <AccessTree {...tree} className="hidden lg:flex" />
            {places ? (
              <p className="hidden text-xs text-muted-foreground lg:block">
                {t("tree.boundary", { places })}
              </p>
            ) : null}
          </aside>
          {shown ? (
            <AccessPanel view={shown} />
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
      </PageBody>
    </>
  )
}
