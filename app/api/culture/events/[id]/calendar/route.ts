import { loadEventContext } from "@/src/features/culture/server/repository"
import { eventCalendar } from "@/src/features/culture/domain/calendar"
import { PUBLIC_HTTP_CACHE } from "@/src/features/culture/server/public-cache"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await loadEventContext(id)
  if (!result) return new Response("Acte no trobat", { status: 404 })
  return new Response(
    eventCalendar(
      result.event,
      result.event.translations.ca,
      result.catalog.places.find((place) => place.id === result.event.place_id)
    ),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="acte-${result.event.id}.ics"`,
        "Cache-Control": PUBLIC_HTTP_CACHE,
      },
    }
  )
}
