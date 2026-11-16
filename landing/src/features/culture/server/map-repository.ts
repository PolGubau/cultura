import "server-only"
import type { MapEvent, MapFilters, MapPage, MapQuery } from "../../../../../shared/culture/types"
import { addDays, toUtc } from "../domain/time"
import { hasDatabase } from "./config"
import { anonymousClient, fields } from "./repository"

const PAGE_SIZE = 200

export async function loadMapEvents(query: MapQuery): Promise<MapPage> {
  if (!hasDatabase()) throw new Error("Database unavailable")
  const db = anonymousClient()
  const from = query.day ?? query.from
  const to = addDays(from, query.day ? 1 : 90)
  let request = db.from("city_events")
    .select(`id,city_id,festival_id,translations,starts_at,ends_at,format,status,place:city_places!city_events_city_id_place_id_fkey!inner(${fields.places}),city:cities!city_events_city_id_fkey!inner(${fields.city})`)
    .eq("publication", "published")
    .gt("ends_at", toUtc(`${from}T00:00`, "Europe/Madrid"))
    .lt("starts_at", toUtc(`${to}T00:00`, "Europe/Madrid"))
    .gte("place.longitude", query.bounds.west).lte("place.longitude", query.bounds.east)
    .gte("place.latitude", query.bounds.south).lte("place.latitude", query.bounds.north)
    .order("starts_at").order("id")
    .range(query.offset ?? 0, (query.offset ?? 0) + PAGE_SIZE)
  if (query.city) request = request.eq("city_id", query.city)
  if (query.festival) request = request.eq("festival_id", query.festival)
  const { data, error } = await request
  if (error || !data) throw new Error("Map query failed")
  const events = data as unknown as MapEvent[]
  const next = (query.offset ?? 0) + PAGE_SIZE
  return { events: events.slice(0, PAGE_SIZE), nextOffset: events.length > PAGE_SIZE && next <= 100000 ? next : null, limitReached: events.length > PAGE_SIZE && next > 100000 }
}

export async function loadMapFilters(): Promise<MapFilters> {
  if (!hasDatabase()) throw new Error("Database unavailable")
  const db = anonymousClient()
  // Follow PostgREST's row limit instead of silently dropping municipalities.
  async function all(table: "cities" | "city_festivals", select: string) {
    const items: unknown[] = []
    for (let offset = 0; ; offset += 500) {
      let request = db.from(table).select(select).order("id").range(offset, offset + 499)
      if (table === "city_festivals") request = request.eq("publication", "published")
      const { data, error } = await request
      if (error || !data) throw new Error("Map filters unavailable")
      items.push(...data)
      if (data.length < 500) return items
    }
  }
  const [cities, festivals] = await Promise.all([
    all("cities", fields.city), all("city_festivals", `${fields.festivals},city_id`),
  ])
  return { cities, festivals } as MapFilters
}
