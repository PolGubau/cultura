import { loadEventContext } from "@/src/features/culture/server/repository"
import { eventCalendar } from "@/src/features/culture/domain/calendar"

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
        "Cache-Control": "no-store",
      },
    }
  )
}
