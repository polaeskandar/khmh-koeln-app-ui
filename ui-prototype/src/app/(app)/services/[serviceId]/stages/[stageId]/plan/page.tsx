import { PlanPage } from "@/features/schedule/plan-page"

export default async function StagePlanPage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/stages/[stageId]/plan">) {
  const { serviceId, stageId } = await params
  const { year } = await searchParams

  return <PlanPage serviceId={serviceId} stageId={stageId} year={Number(year)} />
}
