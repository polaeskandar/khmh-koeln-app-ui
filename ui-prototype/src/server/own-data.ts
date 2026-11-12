import "server-only"

import { exportPerson } from "@/server/mock/commands/privacy"
import { getContext } from "@/server/viewer"

export async function ownDataResponse() {
  const { state, viewer } = await getContext()

  return new Response(JSON.stringify(exportPerson(state, viewer.personId), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="khmk-my-data.json"`,
      "Cache-Control": "no-store",
    },
  })
}
