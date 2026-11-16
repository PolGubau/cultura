import type { Announcement, Category, City, CulturalEvent, CultureCatalog, Festival, Place } from "./types"

export type JoinedPublicEvent = CulturalEvent & { place: Place; category: Category }

/** Normalize the joined rows without merging same-slug categories across cities. */
export function makePublicCatalog(input: {
  cities: City[]; selectedCity: string; events: JoinedPublicEvent[]
  festivals: Festival[]; announcements: Announcement[]; from: string; to: string; fetchedAt: string; offset?: number
}): CultureCatalog {
  const categories = new Map<string, Category>()
  const places = new Map<string, Place>()
  const events = input.events.map(({ place, category, ...event }) => {
    categories.set(`${event.city_id}:${category.id}`, { ...category, city_id: event.city_id })
    places.set(place.id, place)
    return event
  })
  const city = input.cities.find((item) => item.id === input.selectedCity) ?? {
    id: "all", name: "Catalunya", timezone: "Europe/Madrid", latitude: 41.75, longitude: 1.7,
  }
  return {
    city, cities: input.cities, selectedCity: input.selectedCity,
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, "ca")),
    places: [...places.values()], festivals: input.festivals, announcements: input.announcements,
    events, from: input.from, to: input.to, fetchedAt: input.fetchedAt, hasMore: events.length >= 1000,
    nextOffset: events.length >= 1000 && (input.offset ?? 0) < 100000 ? (input.offset ?? 0) + 1000 : null,
  }
}

export function mergeCatalogPages(current: CultureCatalog, next: CultureCatalog): CultureCatalog {
  if (current.from !== next.from || current.selectedCity !== next.selectedCity)
    throw new Error("Catalogue pages do not belong to the same selection")
  const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map((item) => [key(item), item])).values()]
  return { ...next,
    events: unique([...current.events, ...next.events], (event) => event.id),
    categories: unique([...current.categories, ...next.categories], (item) => `${item.city_id ?? ""}:${item.id}`),
    places: unique([...current.places, ...next.places], (item) => item.id),
  }
}
