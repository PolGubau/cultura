import { loadMapFilters } from "@/src/features/culture/server/map-repository"

export async function GET() {
  try {
    return Response.json({ data: await loadMapFilters() }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } })
  } catch {
    return Response.json({ error: "No es poden carregar els filtres." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}