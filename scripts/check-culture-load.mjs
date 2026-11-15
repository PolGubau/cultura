import assert from "node:assert/strict"
import { localOrigin, buildLocal, startLocal } from "./lib/culture-local.mjs"
import { cultureUpstream } from "./fixtures/culture-upstream.mjs"

// Strictly local, bounded test. It never connects to or writes a real Supabase project.
// Uses a separate .next-culture-load build; the deployable .next is untouched.
const origin = localOrigin("http://127.0.0.1:3108")
const upstream = await cultureUpstream()
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: upstream.url,
  // Synthetic placeholder, not a credential and never used outside loopback.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-fixture-not-a-credential",
  CULTURE_CITY_ID: "mataro",
  CULTURE_LOAD_TEST: "1",
}
let stop

async function request(path, expected = 200) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, expected, `${path}: unexpected status`)
  return { response, body: await response.text() }
}

async function burst(label, path, total, concurrency, check) {
  let cursor = 0
  const times = []
  const started = performance.now()
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor++ < total) {
        const start = performance.now()
        const result = await request(path)
        times.push(performance.now() - start)
        check?.(result)
      }
    })
  )
  times.sort((a, b) => a - b)
  const seconds = (performance.now() - started) / 1000
  console.log(
    `${label}: ${total} requests, concurrency ${concurrency}, ${(total / seconds).toFixed(1)} req/s, p95 ${times[Math.ceil(times.length * 0.95) - 1].toFixed(0)} ms, 0 errors`
  )
}

try {
  console.log(
    "Building a LOCAL fixture production server with 1,000 synthetic events…"
  )
  await buildLocal(env)
  stop = await startLocal(origin, env)

  const coldPath = "/api/culture?from=2031-07-01"
  const before = upstream.calls()
  await burst("Cold catalog", coldPath, 24, 24, ({ response, body }) => {
    const result = JSON.parse(body)
    assert.equal(result.data.events.length, 1000)
    assert.equal(result.data.hasMore, true)
    assert.equal(result.error, null)
    assert.match(response.headers.get("cache-control"), /s-maxage=15/)
    assert.equal(response.headers.get("x-culture-public"), "1")
    assert.equal(response.headers.get("set-cookie"), null)
  })
  assert.equal(
    upstream.calls() - before,
    6,
    "Cold concurrent loads must share six upstream reads"
  )

  const warm = upstream.calls()
  await burst("Warm catalog", coldPath, 120, 24)
  assert.equal(upstream.calls(), warm, "Warm catalog must not query upstream")

  await request("/")
  const htmlStart = upstream.calls()
  await burst("Warm HTML", "/", 120, 24, ({ body }) => {
    assert.ok(body.includes("Agenda cultural de Mataró"))
    assert.equal((body.match(/<article/g) ?? []).length, 60)
  })
  assert.equal(
    upstream.calls(),
    htmlStart,
    "Cached HTML must not query upstream"
  )

  // Cookie-bearing visitors must receive exactly the same anonymous catalog.
  const authenticated = await fetch(new URL(coldPath, origin), {
    headers: { Cookie: "synthetic-admin=not-a-session" },
  })
  assert.equal((await authenticated.json()).data.events.length, 1000)
  assert.equal(upstream.calls(), htmlStart)

  upstream.fail(true)
  const outageCalls = upstream.calls()
  await request(coldPath)
  assert.equal(
    upstream.calls(),
    outageCalls,
    "Warm snapshots must survive an upstream outage"
  )
  const failed = await request("/api/culture?from=2032-01-01", 503)
  assert.equal(failed.response.headers.get("cache-control"), "no-store")
  assert.equal(failed.response.headers.get("x-culture-public"), null)
  upstream.fail(false)
  await request("/api/culture?from=2032-01-01")
  await request("/api/culture?from=invalid", 400)
  upstream.assertValid()
  console.log(
    "PASS: cold coalescing, warm cache isolation, 60-card HTML, anonymous queries, error recovery. No real database/CDN/device capacity was measured."
  )
} finally {
  stop?.()
  await upstream.close()
}
