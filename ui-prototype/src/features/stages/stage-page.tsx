import { type Crumb, Topbar } from "@/components/app-shell/topbar"
import { type StageLink, type StageTab, useStageCrumbs } from "./stage-header"

/** Top bar with the stage's breadcrumbs (Services › Sunday School › Stages › 3rd Class › …). */
export function StageCrumbsTopbar({
  h,
  tab,
  extra,
  actions,
}: {
  h: StageLink
  tab: StageTab
  extra?: Crumb[]
  actions?: React.ReactNode
}) {
  const crumbs = useStageCrumbs(h, tab, extra)
  return <Topbar crumbs={crumbs} actions={actions} />
}
