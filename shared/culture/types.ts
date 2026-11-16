export type Locale = "ca" | "es" | "en"
export type Publication = "draft" | "published"
export type CityRole = "owner" | "editor" | "viewer"
export type EventText = { title: string; summary: string; description: string }
export type RoutePoint = { lat: number; lng: number }
export interface City {
  id: string
  name: string
  timezone: string
  latitude: number
  longitude: number
}
export interface Category { id: string; name: string; city_id?: string }
export interface Place extends Category {
  address: string
  latitude: number
  longitude: number
}
export interface Festival {
  id: string
  city_id?: string
  name: string
  description: string
  starts_on: string
  ends_on: string
  logo_url: string | null
  primary_color: string
  auto_activate: boolean
  priority: number
  publication: Publication
}
export interface CulturalEvent {
  id: string
  city_id: string
  festival_id: string | null
  place_id: string
  category_id: string
  translations: { ca: EventText; es?: EventText; en?: EventText }
  starts_at: string
  ends_at: string
  format: "timed" | "exhibition"
  route: RoutePoint[] | null
  image_url: string | null
  booking_url: string | null
  price: string
  accessibility: string
  schedule_notes: string
  organizer: string
  source: string | null
  external_id: string | null
  publication: Publication
  status: "scheduled" | "cancelled"
  cancellation_reason: string | null
  updated_at: string
}
export interface Announcement {
  id: string
  city_id?: string
  festival_id: string | null
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  starts_at: string
  ends_at: string
  publication: Publication
}
export interface CultureCatalog {
  city: City
  cities?: City[]
  selectedCity?: string
  categories: Category[]
  places: Place[]
  festivals: Festival[]
  events: CulturalEvent[]
  announcements: Announcement[]
  fetchedAt: string
  from: string
  to: string
  hasMore: boolean
  nextOffset?: number | null
}
export type CatalogResult = { data: CultureCatalog | null; error: string | null }
export type MapBounds = { west: number; south: number; east: number; north: number }
export type MapEvent = Pick<CulturalEvent, "id" | "city_id" | "festival_id" | "translations" | "starts_at" | "ends_at" | "format" | "status"> & { place: Place; city: City }
export type MapPage = { events: MapEvent[]; nextOffset: number | null; limitReached?: boolean }
export type MapFilters = { cities: City[]; festivals: (Festival & { city_id: string })[] }
export type MapQuery = { bounds: MapBounds; from: string; day?: string; city?: string; festival?: string; offset?: number }
export type ActionResult = { error?: string; success?: string; id?: string }
type RequiredEventFields = "starts_at" | "ends_at" | "place_id" | "category_id" | "format" | "publication" | "status"
type EventTextInput = Pick<EventText, "title" | "summary"> & Partial<Pick<EventText, "description">>
/** HTTP write contract: omitted optional fields are reset by a full PUT replacement. */
export type EventInput = Pick<CulturalEvent, RequiredEventFields> &
  Partial<Omit<CulturalEvent, RequiredEventFields | "id" | "city_id" | "updated_at" | "source" | "external_id" | "translations">> & {
    external_id: string
    translations: { ca: EventTextInput; es?: EventTextInput; en?: EventTextInput }
  }
