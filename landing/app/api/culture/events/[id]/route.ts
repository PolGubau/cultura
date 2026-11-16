import { loadEventContext } from "@/src/features/culture/server/repository"
import { PUBLIC_HTTP_CACHE } from "@/src/features/culture/server/public-cache"
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const data = await loadEventContext((await context.params).id)
    return Response.json({ data }, { status: data ? 200 : 404, headers: {
      "Cache-Control": data ? PUBLIC_HTTP_CACHE : "no-store",
    } })
  } catch {
    return Response.json({ error: "Agenda no disponible." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } })
  }
}