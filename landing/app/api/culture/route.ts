import { loadCatalog } from "@/src/features/culture/server/repository"
import { validDay } from "@/src/features/culture/domain/time"
import { PUBLIC_HTTP_CACHE } from "@/src/features/culture/server/public-cache"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const from = params.get("from") ?? undefined
  const city = params.get("city") ?? ""
  const rawOffset = params.get("offset") ?? "0"
  if (!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset) || Number(rawOffset) > 100000 || Number(rawOffset) % 1000 !== 0)
    return Response.json({ error: "Pàgina no vàlida." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  if (city && !/^[a-z0-9-]{1,80}$/.test(city))
    return Response.json({ error: "Municipi no vàlid." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  if (from && (!validDay(from) || from < "1900-01-01" || from > "2200-01-01")) {
    return Response.json(
      { error: "Data no vàlida." },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
  const result = await loadCatalog(from, false, city, Number(rawOffset))
  return Response.json(result, {
    status: result.data ? 200 : 503,
    headers: {
      "Cache-Control": result.data ? PUBLIC_HTTP_CACHE : "no-store",
      ...(result.data ? { "X-Culture-Public": "1" } : {}),
      ...(!result.data ? { "Retry-After": "30" } : {}),
    },
  })
}
