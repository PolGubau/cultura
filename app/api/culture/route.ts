import { loadCatalog } from "@/src/features/culture/server/repository"
import { validDay } from "@/src/features/culture/domain/time"
import { PUBLIC_HTTP_CACHE } from "@/src/features/culture/server/public-cache"

export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from") ?? undefined
  if (from && (!validDay(from) || from < "1900-01-01" || from > "2200-01-01")) {
    return Response.json(
      { error: "Data no vàlida." },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
  const result = await loadCatalog(from)
  return Response.json(result, {
    status: result.data ? 200 : 503,
    headers: {
      "Cache-Control": result.data ? PUBLIC_HTTP_CACHE : "no-store",
      ...(result.data ? { "X-Culture-Public": "1" } : {}),
      ...(!result.data ? { "Retry-After": "30" } : {}),
    },
  })
}
