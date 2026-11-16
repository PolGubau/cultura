import { parseMapQuery } from "../../../../../shared/culture/map"
import { loadMapEvents } from "@/src/features/culture/server/map-repository"

export async function GET(request: Request) {
  const query = parseMapQuery(new URL(request.url).searchParams)
  if (!query) return Response.json({ error: "Filtres del mapa no vàlids." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  try {
    return Response.json({ data: await loadMapEvents(query) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "No es poden carregar els actes del mapa." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } })
  }
}