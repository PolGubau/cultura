import { loadCatalog } from "@/src/features/culture/server/repository"
import { validDay } from "@/src/features/culture/domain/time"

export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from") ?? undefined
  if (from && (!validDay(from) || from < "1900-01-01" || from > "2200-01-01")) {
    return Response.json({ error: "Data no vàlida." }, { status: 400 })
  }
  const result = await loadCatalog(from)
  return Response.json(result, {
    status: result.data ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Culture-Public": "1" },
  })
}
