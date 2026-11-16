import { test } from "node:test"
import assert from "node:assert/strict"
import { categoryKey, filterEvents, searchCities } from "../../shared/culture/catalog.ts"
import { makePublicCatalog, mergeCatalogPages, type JoinedPublicEvent } from "../../shared/culture/public-catalog.ts"
import type { City } from "../../shared/culture/types.ts"
import { event } from "./culture-fixtures.ts"

const cities: City[] = [
  { id: "mataro", name: "Mataró", timezone: "Europe/Madrid", latitude: 41.5, longitude: 2.4 },
  { id: "girona", name: "Girona", timezone: "Europe/Madrid", latitude: 42, longitude: 2.8 },
]
function joined(id: string, city: string): JoinedPublicEvent {
  return { ...event({ id, city_id: city, place_id: `place-${city}` }),
    place: { id: `place-${city}`, name: city, address: "", latitude: 41, longitude: 2 },
    category: { id: "musica", name: `Música ${city}` } }
}
function page(events: JoinedPublicEvent[], selectedCity = "", offset = 0) {
  return makePublicCatalog({ cities, selectedCity, events, festivals: [], announcements: [],
    from: "2027-07-01", to: "2027-09-29", fetchedAt: "2027-07-01T00:00:00Z", offset })
}

test("multicity catalog keeps identical category slugs distinct and filters by municipality", () => {
  const catalog = page([joined("1", "mataro"), joined("2", "girona")])
  assert.equal(catalog.city.name, "Catalunya")
  assert.equal(catalog.categories.length, 2)
  const gironaCategory = catalog.categories.find((item) => item.city_id === "girona")!
  assert.deepEqual(filterEvents(catalog.events, { locale: "ca", category: categoryKey(gironaCategory) }).map((item) => item.id), ["2"])
  assert.equal(page([joined("2", "girona")], "girona").city.name, "Girona")
})

test("municipality search ignores accents and limits results", () => {
  assert.deepEqual(searchCities(cities, "  MATARO ").map((city) => city.id), ["mataro"])
  assert.equal(searchCities(cities, "", 1).length, 1)
})

test("pages merge without duplicates, preserve related resources and reject different selections", () => {
  const first = page(Array.from({ length: 1000 }, (_, i) => joined(String(i), "mataro")))
  const second = page([joined("999", "mataro"), joined("1000", "girona")], "", 1000)
  assert.equal(first.nextOffset, 1000)
  const merged = mergeCatalogPages(first, second)
  assert.equal(merged.events.length, 1001)
  assert.equal(merged.categories.length, 2)
  assert.equal(merged.places.length, 2)
  assert.equal(merged.nextOffset, null)
  assert.throws(() => mergeCatalogPages(first, page([], "girona")), /same selection/)
  assert.equal(page(Array.from({ length: 1000 }, (_, i) => joined(String(i), "mataro")), "", 100000).nextOffset, null)
})
