import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"

const source = await readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
)

function worker() {
  const handlers = new Map()
  const stores = new Map()
  const origin = "https://culture.example"
  const key = (request) =>
    new URL(typeof request === "string" ? request : request.url, origin).href
  const cache = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      put: async (request, response) => {
        store.set(key(request), response.clone())
      },
      match: async (request) => store.get(key(request))?.clone(),
      keys: async () => [...store.keys()].map((url) => new Request(url)),
      delete: async (request) => store.delete(key(request)),
      addAll: async (urls) => {
        urls.forEach((url) => store.set(key(url), new Response("shell")))
      },
    }
  }
  let network = async () =>
    Response.json(
      { data: { events: [] } },
      { headers: { "X-Culture-Public": "1" } }
    )
  const caches = {
    open: async (name) => cache(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      for (const name of stores.keys()) {
        const found = await cache(name).match(request)
        if (found) return found
      }
    },
  }
  runInNewContext(source, {
    self: {
      location: { origin },
      clients: { claim: async () => {} },
      addEventListener: (name, callback) => handlers.set(name, callback),
    },
    caches,
    fetch: (...args) => network(...args),
    URL,
    Request,
    Response,
    Headers,
  })
  return {
    caches,
    setNetwork: (fn) => {
      network = fn
    },
    async install() {
      let done
      handlers.get("install")({
        waitUntil: (promise) => {
          done = promise
        },
      })
      await done
    },
    async request(path, options = {}) {
      let response
      handlers.get("fetch")({
        request: {
          url: `${origin}${path}`,
          method: "GET",
          mode: "cors",
          ...options,
        },
        respondWith: (promise) => {
          response = promise
        },
      })
      return response
    },
  }
}

test("worker never intercepts admin, RSC, cross-origin requests or mutations", async () => {
  const app = worker()
  for (const path of ["/admin", "/admin/events", "/api/private", "/?rsc=1"])
    assert.equal(await app.request(path), undefined)
  assert.equal(await app.request("/api/culture", { method: "POST" }), undefined)
  assert.equal(
    await app.request("/api/culture", {
      url: "https://other.example/api/culture",
    }),
    undefined
  )
})

test("only successful explicitly public catalogs are stored", async () => {
  const app = worker()
  app.setNetwork(async () => Response.json({ private: true }))
  await app.request("/api/culture")
  const cache = await app.caches.open("culture-v1-data")
  assert.equal((await cache.keys()).length, 0)
  app.setNetwork(async () =>
    Response.json({}, { status: 503, headers: { "X-Culture-Public": "1" } })
  )
  await app.request("/api/culture")
  assert.equal((await cache.keys()).length, 0)
})

test("cached data is labelled stale after network failure", async () => {
  const app = worker()
  await app.request("/api/culture?from=2027-07-25")
  app.setNetwork(async () => {
    throw new TypeError("Network unavailable")
  })
  const response = await app.request("/api/culture?from=2027-07-25")
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("X-Culture-Offline"), "1")
  assert.deepEqual(await response.json(), { data: { events: [] } })
  assert.equal(
    (await app.request("/api/culture?from=2027-08-01")).type,
    "error"
  )
})

test("offline cache is bounded to twelve public catalogs", async () => {
  const app = worker()
  for (let day = 1; day <= 14; day++)
    await app.request(
      `/api/culture?from=2027-07-${String(day).padStart(2, "0")}`
    )
  const cache = await app.caches.open("culture-v1-data")
  assert.equal((await cache.keys()).length, 12)
  assert.equal(await cache.match("/api/culture?from=2027-07-01"), undefined)
  assert.ok(await cache.match("/api/culture?from=2027-07-14"))
})

test("offline navigation serves the reader only for public agenda pages", async () => {
  const app = worker()
  await app.install()
  app.setNetwork(async () => {
    throw new TypeError("Network unavailable")
  })
  for (const path of [
    "/",
    "/ara",
    "/favorits",
    "/actes/11111111-1111-4111-8111-111111111111",
  ]) {
    assert.equal(
      await (await app.request(path, { mode: "navigate" })).text(),
      "shell"
    )
  }
  assert.equal(
    await app.request("/admin/events", { mode: "navigate" }),
    undefined
  )
})
