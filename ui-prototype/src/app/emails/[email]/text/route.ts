import { isEmailId, renderForRequest } from "@/server/emails/emails"

/** An email's plain-text part on its own (`?lang=ar`). */
export async function GET(request: Request, ctx: RouteContext<"/emails/[email]/text">) {
  const { email: id } = await ctx.params
  if (!isEmailId(id)) return new Response("Not found", { status: 404 })
  return new Response(renderForRequest(id, request).text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
