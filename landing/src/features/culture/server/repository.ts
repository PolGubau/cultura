import "server-only"
import { createClient as publicClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { CITY_ID, FALLBACK_CITY, hasDatabase } from "./config"
import { addDays, dayKey, toUtc, validDay } from "../domain/time"
import type { CatalogResult, City, CultureCatalog } from "../domain/types"
import { cachePublicJson } from "./public-cache"
import { makePublicCatalog, type JoinedPublicEvent } from "../../../../../shared/culture/public-catalog"

export const fields = {
  city: "id,name,timezone,latitude,longitude",
  categories: "id,name",
  places: "id,name,address,latitude,longitude",
  festivals:
    "id,name,description,starts_on,ends_on,logo_url,primary_color,auto_activate,priority,publication",
  events:
    "id,city_id,festival_id,place_id,category_id,translations,starts_at,ends_at,format,route,image_url,booking_url,price,accessibility,schedule_notes,organizer,source,external_id,publication,status,cancellation_reason,updated_at",
  announcements:
    "id,festival_id,title,message,severity,starts_at,ends_at,publication",
} as const

export function anonymousClient() {
  return publicClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(8_000)])
              : AbortSignal.timeout(8_000),
          }),
      },
    }
  )
}

async function queryCatalog(
  fromInput?: string,
  admin = false,
  cityId = CITY_ID
): Promise<CatalogResult> {
  if (!hasDatabase())
    return {
      data: null,
      error: "Base de dades pendent de configurar. Consulta docs/CULTURE.md.",
    }
  // A public request NEVER inherits an admin's session, even on the same browser.
  const db = admin ? await createClient() : anonymousClient()
  const { data: city, error: cityError } = await db
    .from("cities")
    .select(fields.city)
    .eq("id", cityId)
    .single()
  if (cityError || !city)
    return {
      data: null,
      error:
        "No es pot carregar la ciutat. Comprova la connexió i les migracions.",
    }
  const currentCity = city as unknown as City
  const today = dayKey(new Date(), currentCity.timezone)
  const from = fromInput && validDay(fromInput) ? fromInput : today
  const to = addDays(from, 90)
  const start = toUtc(`${from}T00:00`, currentCity.timezone)
  const end = toUtc(`${to}T00:00`, currentCity.timezone)
  let eventQuery = db
    .from("city_events")
    .select(fields.events)
    .eq("city_id", cityId)
    .gt("ends_at", start)
    .lt("starts_at", end)
    .order("starts_at")
    .order("id")
    .limit(1000)
  let festivalsQuery = db
    .from("city_festivals")
    .select(fields.festivals)
    .eq("city_id", cityId)
    .order("starts_on", { ascending: false })
  let announcementQuery = db
    .from("city_announcements")
    .select(fields.announcements)
    .eq("city_id", cityId)
    .order("starts_at", { ascending: false })
    .limit(100)
  if (!admin) {
    eventQuery = eventQuery.eq("publication", "published")
    festivalsQuery = festivalsQuery.eq("publication", "published")
    announcementQuery = announcementQuery.eq("publication", "published")
  }
  const [categories, places, festivals, events, announcements] =
    await Promise.all([
      db
        .from("city_categories")
        .select(fields.categories)
        .eq("city_id", cityId)
        .order("name"),
      db
        .from("city_places")
        .select(fields.places)
        .eq("city_id", cityId)
        .order("name"),
      festivalsQuery,
      eventQuery,
      announcementQuery,
    ])
  if (
    [categories, places, festivals, events, announcements].some(
      (result) => result.error
    )
  ) {
    return {
      data: null,
      error:
        "Impossible carregar l’agenda. Reintenta-ho; si persisteix, revisa les migracions.",
    }
  }
  return {
    data: {
      city: currentCity,
      categories: categories.data,
      places: places.data,
      festivals: festivals.data,
      events: events.data!.slice(0, 1000),
      announcements: announcements.data,
      from,
      to,
      // Conservative at the cap: no full-table COUNT on every catalog refresh.
      hasMore: events.data!.length >= 1000,
      fetchedAt: new Date().toISOString(),
    } as unknown as CultureCatalog,
    error: null,
  }
}

async function queryPublicCatalog(from: string, cityId: string, offset: number): Promise<CultureCatalog> {
  const db = anonymousClient()
  const to = addDays(from, 90)
  async function all(table: "cities" | "city_festivals", select: string) {
    const items: unknown[] = []
    for (let offset = 0; ; offset += 500) {
      let request = db.from(table).select(select).order("id").range(offset, offset + 499)
      if (table === "city_festivals") {
        request = request.eq("publication", "published")
        if (cityId) request = request.eq("city_id", cityId)
      }
      const { data, error } = await request
      if (error || !data) throw new Error("Public metadata unavailable")
      items.push(...data)
      if (data.length < 500) return items
    }
  }
  let events = db.from("city_events")
    .select(`${fields.events},place:city_places!city_events_city_id_place_id_fkey!inner(${fields.places}),category:city_categories!city_events_city_id_category_id_fkey!inner(${fields.categories})`)
    .eq("publication", "published")
    .gt("ends_at", toUtc(`${from}T00:00`, "Europe/Madrid"))
    .lt("starts_at", toUtc(`${to}T00:00`, "Europe/Madrid"))
    .order("starts_at").order("id").range(offset, offset + 999)
  if (cityId) events = events.eq("city_id", cityId)
  let announcements = db.from("city_announcements").select(`${fields.announcements},city_id`)
    .eq("publication", "published").order("starts_at", { ascending: false }).limit(100)
  if (cityId) announcements = announcements.eq("city_id", cityId)
  const [cities, festivals, rows, notices] = await Promise.all([
    all("cities", fields.city), all("city_festivals", `${fields.festivals},city_id`), events, announcements,
  ])
  if (rows.error || notices.error || !rows.data || !notices.data ||
      (cityId && !cities.some((item) => (item as City).id === cityId))) throw new Error("Public catalogue unavailable")
  return makePublicCatalog({
    cities: cities as City[], selectedCity: cityId,
    festivals: festivals as CultureCatalog["festivals"], events: rows.data as unknown as JoinedPublicEvent[],
    announcements: notices.data as CultureCatalog["announcements"], from, to, offset, fetchedAt: new Date().toISOString(),
  })
}

const cachedCatalog = cachePublicJson("culture-multicity-catalog-v2", async (key) => {
  const [from, cityId, offset] = JSON.parse(key) as [string, string, number]
  return queryPublicCatalog(from, cityId, offset)
})

export async function loadCatalog(
  fromInput?: string,
  admin = false,
  cityId = "",
  offset = 0
): Promise<CatalogResult> {
  if (admin || !hasDatabase()) return queryCatalog(fromInput, admin)
  const from =
    fromInput && validDay(fromInput)
      ? fromInput
      : dayKey(new Date(), FALLBACK_CITY.timezone)
  try {
    return { data: await cachedCatalog(JSON.stringify([from, cityId, offset])), error: null }
  } catch {
    return {
      data: null,
      error: "Impossible carregar l’agenda. Torna-ho a provar.",
    }
  }
}

const cachedEvent = cachePublicJson("culture-event-v1", async (id) => {
  const { data, error } = await anonymousClient()
    .from("city_events")
    .select(fields.events)
    .eq("id", id)
    .eq("publication", "published")
    .maybeSingle()
  if (error) throw new Error("No es pot carregar l’acte. Torna-ho a provar.")
  return data as unknown as CultureCatalog["events"][number] | null
})

export async function loadPublicEvent(id: string) {
  if (
    !hasDatabase() ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null
  return cachedEvent(id.toLowerCase())
}

export async function loadEventContext(id: string) {
  const event = await loadPublicEvent(id)
  if (!event) return null
  const result = await queryCatalog(dayKey(event.starts_at, FALLBACK_CITY.timezone), false, event.city_id)
  if (!result.data) throw new Error("No es pot carregar el context de l’acte.")
  // Related resources can be beyond PostgREST's catalog row limit.
  const db = anonymousClient()
  const [place, festival] = await Promise.all([
    db.from("city_places").select(fields.places).eq("city_id", event.city_id).eq("id", event.place_id).single(),
    event.festival_id ? db.from("city_festivals").select(fields.festivals).eq("city_id", event.city_id).eq("id", event.festival_id).eq("publication", "published").single() : Promise.resolve({ data: null, error: null }),
  ])
  if (place.error || festival.error) throw new Error("No es pot carregar el context de l’acte.")
  // Include a directly linked event even if a busy 90-day window exceeds the list limit.
  const events = result.data.events.some((item) => item.id === event.id)
    ? result.data.events
    : [...result.data.events, event]
  return { event, catalog: { ...result.data, events,
    places: place.data ? [...result.data.places.filter((item) => item.id !== event.place_id), place.data] : result.data.places,
    festivals: festival.data ? [...result.data.festivals.filter((item) => item.id !== event.festival_id), festival.data] : result.data.festivals,
  } as CultureCatalog }
}
