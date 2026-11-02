import { isEmailId, renderForRequest } from "@/server/emails/emails"

/** An email's HTML part on its own, as a mail client gets it (`?lang=de&link=forgot`). */
export async function GET(request: Request, ctx: RouteContext<"/emails/[email]/html">) {
  const { email: id } = await ctx.params
  if (!isEmailId(id)) return new Response("Not found", { status: 404 })
  return new Response(renderForRequest(id, request).html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}
