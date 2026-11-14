import { notFound } from "next/navigation"

import { isAdministrator } from "@/server/mock/access"
import { exportPerson } from "@/server/mock/commands/privacy"
import { getContext } from "@/server/viewer"

export async function GET(_: Request, { params }: RouteContext<"/admin/data/[requestId]/copy">) {
  const { requestId } = await params
  const { state, viewer } = await getContext()
  const request = state.dataRequests.find((r) => r.id === requestId)

  if (!request || !request.personId || request.kind !== "copy" || !isAdministrator(state, viewer)) {
    notFound()
  }

  return new Response(JSON.stringify(exportPerson(state, request.personId), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="khmk-data-${request.id}.json"`,
      "Cache-Control": "no-store",
    },
  })
}
