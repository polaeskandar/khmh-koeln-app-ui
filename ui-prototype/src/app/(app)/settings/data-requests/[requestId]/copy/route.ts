import { ProblemError } from "@/server/errors"
import { personalDataForRequest } from "@/server/mock/commands/privacy"
import { getContext } from "@/server/viewer"

/** The copy of a request's data as a JSON file, for the administrator to send on (DSGVO Art. 15). */
export async function GET(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const { state, viewer } = await getContext()
  try {
    const { request, data } = personalDataForRequest(state, viewer, requestId)
    return Response.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="khmk-data-${request.receivedAt.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof ProblemError) return new Response(null, { status: error.problem.status })
    throw error
  }
}
