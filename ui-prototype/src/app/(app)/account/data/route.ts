import { ownPersonalData } from "@/server/mock/commands/privacy"
import { getContext } from "@/server/viewer"

/** Everyone can download what the app stores about them (DSGVO Art. 15 and 20). */
export async function GET() {
  const { state, viewer } = await getContext()
  return Response.json(ownPersonalData(state, viewer), {
    headers: {
      "Content-Disposition": 'attachment; filename="khmk-my-data.json"',
      "Cache-Control": "no-store",
    },
  })
}
