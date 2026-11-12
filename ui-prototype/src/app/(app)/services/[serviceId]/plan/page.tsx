import { PlanPage } from "@/features/schedule/plan-page"

export default async function ServicePlanPage({
  params,
  searchParams,
}: PageProps<"/services/[serviceId]/plan">) {
  const { serviceId } = await params
  const { year } = await searchParams

  return <PlanPage serviceId={serviceId} stageId={null} year={Number(year)} />
}
