import assert from "node:assert/strict"
import { createServer } from "node:http"
import { localOrigin, buildLocal, startLocal } from "./lib/culture-local.mjs"
import { event } from "../tests/culture-fixtures.ts"

// Loopback fixtures only; no real database, users or credentials.
const requests = []
const upstream = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1")
  requests.push(url)
  response.setHeader("content-type", "application/json")
  const mapQuery = url.pathname.endsWith("/city_events") && url.searchParams.has("place.latitude")
  if (mapQuery) {
    const offset = Number(url.searchParams.get("offset") ?? 0)
    const rows = offset ? [] : Array.from({ length: 201 }, (_, i) => ({
      id: String(i), city_id: i % 2 ? "girona" : "mataro", translations: { ca: { title: `Event ${i}` } },
      place: { latitude: 41, longitude: 2 }, city: { id: i % 2 ? "girona" : "mataro" },
    }))
    response.end(JSON.stringify(rows))
  } else if (url.pathname.endsWith("/cities")) {
    response.end(JSON.stringify(["girona", "mataro"].map((id) => ({ id, name: id, timezone: "Europe/Madrid", latitude: 41, longitude: 2 }))))
  } else if (url.pathname.endsWith("/city_announcements")) {
    const cityId = url.searchParams.get("city_id")?.replace("eq.", "") ?? "girona"
    response.end(JSON.stringify([{ id: "notice", city_id: cityId, festival_id: null, title: "Avís", message: "", severity: "info", starts_at: "2027-07-01T00:00:00Z", ends_at: "2027-07-02T00:00:00Z", publication: "published" }]))
  } else if (url.pathname.endsWith("/city_events")) {
    const offset = Number(url.searchParams.get("offset") ?? 0)
    const city = url.searchParams.get("city_id")?.replace("eq.", "")
    const rows = offset ? [1000] : Array.from({ length: 1000 }, (_, i) => i)
    response.end(JSON.stringify(rows.map((i) => {
      const cityId = city ?? (i % 2 ? "girona" : "mataro")
      return { ...event({ id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`, city_id: cityId, place_id: `place-${cityId}` }),
        place: { id: `place-${cityId}`, name: cityId, address: "", latitude: 41, longitude: 2 },
        category: { id: "musica", name: `Música ${cityId}` } }
    })))
  } else response.end(JSON.stringify([]))
})
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve))
const address = upstream.address()
const origin = localOrigin("http://127.0.0.1:3110")
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-fixture-not-a-credential", CULTURE_LOAD_TEST: "1" }
let stop
try {
  await buildLocal(env)
  stop = await startLocal(origin, env)
  const query = "west=1&south=40&east=4&north=43&from=2027-07-01"
  const response = await fetch(new URL(`/api/culture/map?${query}`, origin))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const first = (await response.json()).data
  assert.equal(first.events.length, 200)
  assert.equal(first.nextOffset, 200)
  assert.deepEqual(new Set(first.events.map((event) => event.city_id)), new Set(["mataro", "girona"]))
  const sent = requests.findLast((item) => item.pathname.endsWith("/city_events") && item.searchParams.has("place.latitude"))
  assert.equal(sent.searchParams.get("publication"), "eq.published")
  assert.equal(sent.searchParams.get("city_id"), null)
  assert.equal(sent.searchParams.getAll("place.latitude").length, 2)
  assert.equal(sent.searchParams.getAll("place.longitude").length, 2)
  assert.match(sent.searchParams.get("select"), /city_places!city_events_city_id_place_id_fkey!inner/)
  const second = await fetch(new URL(`/api/culture/map?${query}&city=girona&offset=200`, origin))
  assert.equal(second.status, 200)
  assert.equal((await second.json()).data.nextOffset, null)
  const filtered = requests.findLast((item) => item.pathname.endsWith("/city_events"))
  assert.equal(filtered.searchParams.get("city_id"), "eq.girona")
  assert.equal(filtered.searchParams.get("offset"), "200")
  assert.equal((await fetch(new URL("/api/culture/map?west=NaN", origin))).status, 400)
  const catalog = (await (await fetch(new URL("/api/culture?from=2027-07-01", origin))).json()).data
  assert.equal(catalog.events.length, 1000)
  assert.equal(catalog.nextOffset, 1000)
  assert.equal(catalog.announcements[0].city_id, "girona")
  assert.deepEqual(new Set(catalog.categories.map((item) => item.city_id)), new Set(["mataro", "girona"]))
  const catalogPage = await fetch(new URL("/api/culture?from=2027-07-01&city=girona&offset=1000", origin))
  assert.equal(catalogPage.status, 200)
  const page = (await catalogPage.json()).data
  assert.equal(page.selectedCity, "girona")
  assert.equal(page.events[0].city_id, "girona")
  assert.equal(page.announcements[0].city_id, "girona")
  assert.equal(page.nextOffset, null)
  const catalogQuery = requests.findLast((item) => item.pathname.endsWith("/city_events"))
  assert.equal(catalogQuery.searchParams.get("city_id"), "eq.girona")
  assert.equal(catalogQuery.searchParams.get("offset"), "1000")
  assert.equal((await fetch(new URL("/api/culture?offset=1", origin))).status, 400)
  assert.equal((await fetch(new URL("/api/culture?city=INVALID", origin))).status, 400)
  console.log("PASS: map and catalog endpoints, viewport, anonymous queries, multiple cities, pagination and validation (mock upstream; not PostgreSQL/RLS).")
} finally {
  stop?.()
  await new Promise((resolve) => upstream.close(resolve))
}
