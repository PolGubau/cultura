/* Public cultural data only. Never cache admin HTML, cookies, RSC responses or mutations. */
const VERSION = "culture-v1"
const SHELL = `${VERSION}-shell`
const DATA = `${VERSION}-data`
const SHELL_FILES = ["/offline.html", "/offline.js", "/culture-icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)))
  // Do not force takeover while an old page may still be open.
})
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith("culture-") && key !== SHELL && key !== DATA
          )
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

async function publicData(request) {
  let response
  try {
    response = await fetch(request)
  } catch {
    // A stored snapshot can also cover a temporarily unavailable origin.
  }
  if (response?.ok) {
    if (response.headers.get("X-Culture-Public") === "1") {
      try {
        const cache = await caches.open(DATA)
        await cache.put(request, response.clone())
        const keys = await cache.keys()
        for (const key of keys.slice(0, Math.max(0, keys.length - 12)))
          await cache.delete(key)
      } catch {
        // Full or unavailable device storage must never hide a good response.
      }
    }
    return response
  }
  try {
    const cache = await caches.open(DATA)
    const cached = await cache.match(request)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set("X-Culture-Offline", "1")
      return new Response(await cached.arrayBuffer(), { headers, status: 200 })
    }
  } catch { /* Storage is optional; the application still works online. */ }
  return response || Response.error()
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin) return
  if (url.pathname === "/api/culture") {
    event.respondWith(publicData(request))
    return
  }
  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    )
    return
  }
  const publicPage =
    ["/", "/ara", "/mapa", "/favorits", "/ajustos"].includes(url.pathname) ||
    /^\/actes\/[0-9a-f-]+$/i.test(url.pathname)
  if (request.mode === "navigate" && publicPage) {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")))
  }
})
