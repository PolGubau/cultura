import { test } from "node:test"
import assert from "node:assert/strict"
import { createCultureClient, CultureApiError } from "../../shared/culture/client.ts"
import { event } from "./culture-fixtures.ts"

test("public SDK never sends authentication; preserves offline labelling and abort signal", async () => {
  const controller = new AbortController()
  const client = createCultureClient("https://culture.invalid/", async (url, init) => {
    assert.equal(url, "https://culture.invalid/api/culture?from=2027-07-25")
    assert.equal(init?.headers, undefined)
    assert.ok(init?.signal)
    return Response.json({ data: { events: [event()] }, error: null }, { headers: { "X-Culture-Offline": "1" } })
  })
  const result = await client.catalog("2027-07-25", controller.signal)
  assert.equal(result.offline, true)
  assert.equal(result.data.events.length, 1)
})
test("municipal SDK sends full replacement and exact strong precondition", async () => {
  const data = event()
  const version = '"2027-07-25T18:00:00.123456Z"'
  // Synthetic test marker, not a credential.
  const marker = "synthetic-integration-test"
  const client = createCultureClient("https://culture.invalid", async (url, init) => {
    assert.equal(url, `https://culture.invalid/api/v1/events/${data.id}`)
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("authorization"), `Bearer ${marker}`)
    if (init?.method === "PUT") assert.equal(headers.get("if-match"), version)
    return Response.json({ data }, { headers: { ETag: version } })
  })
  const loaded = await client.event(marker, data.id)
  assert.equal(loaded.etag, version)
  const { id, city_id, source, updated_at, ...input } = data
  void city_id; void source; void updated_at
  assert.equal((await client.saveEvent(marker, { ...input, external_id: "municipal-42" }, { id, etag: loaded.etag })).etag, version)
})
test("typed API errors retain actionable conflict and rate-limit codes", async () => {
  for (const [status, code] of [[412, "precondition_failed"], [429, "rate_limited"]] as const) {
    const client = createCultureClient("", async () => Response.json({ code, error: "Safe message" }, { status }))
    await assert.rejects(client.events("synthetic-test"), (error: unknown) => error instanceof CultureApiError && error.status === status && error.code === code)
  }
})
test("cancelling a public fetch propagates to transport", async () => {
  const controller = new AbortController()
  const client = createCultureClient("", async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
  }))
  const pending = client.catalog(undefined, controller.signal)
  controller.abort()
  await assert.rejects(pending, /cancelled/)
})

test("SDK preserves status and retry guidance even when a proxy returns HTML", async () => {
  const client = createCultureClient("", async () => new Response("<html>Unavailable</html>", { status: 503, headers: { "Retry-After": "60" } }))
  await assert.rejects(client.events("synthetic-test"), (error: unknown) =>
    error instanceof CultureApiError && error.status === 503 && error.retryAfter === "60")
})

test("SDK refuses a missing event version rather than producing an unsafe update precondition", async () => {
  const client = createCultureClient("", async () => Response.json({ data: event() }))
  await assert.rejects(client.event("synthetic-test", event().id), (error: unknown) =>
    error instanceof CultureApiError && error.code === "missing_version")
})
