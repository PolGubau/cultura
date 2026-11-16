import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { event } from "../../tests/culture-fixtures.ts"

/** Local PostgREST-shaped fixture. This is NOT a database or an RLS emulator. */
export async function cultureUpstream() {
  const city = {
    id: "mataro",
    name: "Mataró",
    timezone: "Europe/Madrid",
    latitude: 41.5381,
    longitude: 2.4447,
  }
  const sample = event()
  const events = Array.from({ length: 1000 }, (_, index) =>
    event({
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      translations: Object.fromEntries(
        ["ca", "es", "en"].map((locale) => [
          locale,
          {
            title: `Acte sintètic ${index + 1} (${locale})`,
            summary: `Resum de càrrega ${index + 1}`,
            description:
              `Descripció sintètica ${index + 1}, idioma ${locale}. `.repeat(
                20
              ),
          },
        ])
      ),
    })
  )
  const tables = {
    cities: city,
    city_categories: [{ id: "musica", name: "Música" }],
    city_places: [
      {
        id: sample.place_id,
        name: "Plaça de prova",
        address: "Mataró",
        latitude: city.latitude,
        longitude: city.longitude,
      },
    ],
    city_festivals: [],
    city_announcements: [],
    city_events: events,
  }
  let calls = 0
  let invalid = 0
  let failing = false
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1")
    const table = url.pathname.replace("/rest/v1/", "")
    calls++
    try {
      assert.equal(request.method, "GET")
      assert.ok(Object.hasOwn(tables, table))
      const cityFilter = url.searchParams.get(table === "cities" ? "id" : "city_id")
      assert.ok(cityFilter === null || cityFilter === "eq.mataro")
      if (
        ["city_events", "city_festivals", "city_announcements"].includes(table)
      ) {
        assert.equal(url.searchParams.get("publication"), "eq.published")
      }
      assert.ok(!(request.headers.prefer ?? "").includes("count=exact"))
      if (table === "city_events" && !url.searchParams.has("id")) {
        assert.equal(url.searchParams.get("limit"), "1000")
      }
    } catch {
      invalid++
    }
    const id = url.searchParams.get("id")?.replace(/^eq\./, "")
    let data =
      table === "city_events" && id
        ? events.filter((item) => item.id === id)
        : tables[table]
    if (table === "cities" && !id) data = [city]
    if (table === "city_events" && !id && url.searchParams.get("select")?.includes("place:city_places")) {
      data = events.map((item) => ({ ...item, place: tables.city_places[0], category: tables.city_categories[0] }))
    }
    if (Array.isArray(data)) {
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const limit = Number(url.searchParams.get("limit") ?? data.length)
      data = data.slice(offset, offset + limit)
    }
    // Include latency to expose cold-request stampedes instead of hiding them.
    setTimeout(() => {
      response.writeHead(failing ? 503 : 200, {
        "Content-Type": "application/json",
      })
      response.end(
        JSON.stringify(failing ? { message: "Synthetic outage" } : data)
      )
    }, 30)
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls: () => calls,
    assertValid: () =>
      assert.equal(invalid, 0, "Upstream query contract violations"),
    fail: (value) => {
      failing = value
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      }),
  }
}
