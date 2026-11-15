import "server-only"
import { createClient as publicClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { CITY_ID, FALLBACK_CITY, hasDatabase } from "./config"
import { addDays, dayKey, toUtc, validDay } from "../domain/time"
import type { CatalogResult, City, CultureCatalog } from "../domain/types"

const fields = {
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

function anonymousClient() {
  return publicClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

export async function loadCatalog(
  fromInput?: string,
  admin = false
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
    .eq("id", CITY_ID)
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
    .select(fields.events, { count: "exact" })
    .eq("city_id", CITY_ID)
    .gt("ends_at", start)
    .lt("starts_at", end)
    .order("starts_at")
    .order("id")
    .limit(1000)
  let festivalsQuery = db
    .from("city_festivals")
    .select(fields.festivals)
    .eq("city_id", CITY_ID)
    .order("starts_on", { ascending: false })
  let announcementQuery = db
    .from("city_announcements")
    .select(fields.announcements)
    .eq("city_id", CITY_ID)
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
        .eq("city_id", CITY_ID)
        .order("name"),
      db
        .from("city_places")
        .select(fields.places)
        .eq("city_id", CITY_ID)
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
      hasMore: (events.count ?? 0) > 1000,
      fetchedAt: new Date().toISOString(),
    } as unknown as CultureCatalog,
    error: null,
  }
}

export async function loadPublicEvent(id: string) {
  if (!hasDatabase() || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await anonymousClient()
    .from("city_events")
    .select(fields.events)
    .eq("city_id", CITY_ID)
    .eq("id", id)
    .eq("publication", "published")
    .maybeSingle()
  if (error) throw new Error("No es pot carregar l’acte. Torna-ho a provar.")
  return data as unknown as CultureCatalog["events"][number] | null
}

export async function loadEventContext(id: string) {
  const event = await loadPublicEvent(id)
  if (!event) return null
  const result = await loadCatalog(
    dayKey(event.starts_at, FALLBACK_CITY.timezone)
  )
  if (!result.data) throw new Error("No es pot carregar el context de l’acte.")
  // Include a directly linked event even if a busy 90-day window exceeds the list limit.
  if (!result.data.events.some((item) => item.id === id))
    result.data.events.push(event)
  return { event, catalog: result.data }
}
