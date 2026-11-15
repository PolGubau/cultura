import assert from "node:assert/strict"
import { localOrigin, startLocal } from "./lib/culture-local.mjs"

// Run against a local production server after next build, never a remote deployment.
const origin = localOrigin(
  process.argv.find((arg) => arg.startsWith("http://")) ??
    "http://127.0.0.1:3107"
)
let checks = 0
const stop = process.argv.includes("--start") ? await startLocal(origin) : null

async function check(path, expected = 200) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(20_000),
  })
  assert.ok(
    [expected].flat().includes(response.status),
    `${path}: unexpected HTTP status ${response.status}`
  )
  checks++
  return response
}

async function runChecks() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1000),
      })
      await response.arrayBuffer()
      if (response.ok) break
    } catch {
      /* Wait for next start to become ready. */
    }
    if (attempt === 29)
      throw new Error("The local production server did not become ready.")
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  for (const path of [
    "/",
    "/ara",
    "/mapa",
    "/favorits",
    "/ajustos",
    "/legal/privacitat",
    "/contacte",
    "/admin",
    "/admin/events",
    "/admin/festivals",
    "/admin/places",
    "/admin/categories",
    "/admin/announcements",
    "/santes-2026",
  ]) {
    const response = await check(path)
    assert.ok(
      (await response.text()).includes("main-content"),
      `${path}: missing main landmark`
    )
  }
  const home = await check("/")
  assert.match(await home.text(), /Agenda cultural de Mataró/)
  const manifest = await (await check("/manifest.webmanifest")).json()
  assert.equal(manifest.start_url, "/")
  assert.equal(manifest.name, "Agenda cultural de Mataró")
  for (const icon of manifest.icons) await check(icon.src)
  await check("/culture-icons/apple-touch-icon.png")
  const worker = await check("/sw.js")
  assert.match(worker.headers.get("cache-control"), /no-store/)
  await check("/offline.html")
  await check("/offline.js")
  await check("/api/culture?from=invalid", 400)
  // Next.js can send HTTP 200 after a streaming shell; its not-found content must
  // still carry noindex so invalid event URLs are never indexed as real events.
  const missingEvent = await (
    await check("/actes/invalid-id", [200, 404])
  ).text()
  assert.ok(missingEvent.includes("Acte no trobat"))
  assert.match(missingEvent, /name="robots" content="[^"]*noindex/)
  await check("/api/culture/events/invalid-id/calendar", 404)
  await check("/opengraph-image")
  console.log(
    `${checks} production HTTP checks passed (pages, manifest, icons, offline assets, metadata and invalid inputs).`
  )
}

try {
  await runChecks()
} finally {
  stop?.()
}
