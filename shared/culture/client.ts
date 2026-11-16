import type { CatalogResult, CulturalEvent, CultureCatalog, EventInput, MapFilters, MapPage, MapQuery } from "./types"

export function catalogPath(from?: string, city?: string, offset?: number): string {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (city) params.set("city", city)
  if (offset) params.set("offset", String(offset))
  const query = params.toString()
  return `/api/culture${query ? `?${query}` : ""}`
}

export class CultureApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter: string | null
  constructor(status: number, code: string, message: string, retryAfter: string | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
    this.name = "CultureApiError"
  }
}

/** No platform dependencies or stored credentials. Supply short-lived JWTs per request. */
export function createCultureClient(baseUrl: string, transport: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, "")
  async function json<T>(path: string, init: RequestInit = {}): Promise<{ data: T; response: Response }> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    init.signal?.addEventListener("abort", abort, { once: true })
    if (init.signal?.aborted) controller.abort()
    const timer = setTimeout(abort, 12_000)
    try {
      const response = await transport(`${base}${path}`, { ...init, signal: controller.signal })
      const value = await response.json().catch(() => null)
      if (!response.ok) throw new CultureApiError(response.status, value?.code ?? "request_failed", value?.error ?? "No es pot completar la petició.", response.headers.get("Retry-After"))
      if (!value || typeof value !== "object") throw new CultureApiError(502, "invalid_response", "Resposta no vàlida del servidor.")
      return { data: value as T, response }
    } finally {
      clearTimeout(timer)
      init.signal?.removeEventListener("abort", abort)
    }
  }
  async function versionedEvent(path: string, init: RequestInit) {
    const result = await json<{ data: CulturalEvent }>(path, init)
    const etag = result.response.headers.get("ETag")
    if (!etag) throw new CultureApiError(502, "missing_version", "El servidor no ha retornat la versió de l’acte. Torna’l a consultar abans d’editar.")
    return { data: result.data.data, etag }
  }
  return {
    async mapFilters(signal?: AbortSignal) {
      return (await json<{ data: MapFilters }>("/api/culture/map/filters", { signal })).data.data
    },
    async mapEvents(query: MapQuery, signal?: AbortSignal) {
      const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(query.bounds).map(([key, value]) => [key, String(value)])), from: query.from })
      if (query.day) params.set("day", query.day)
      if (query.city) params.set("city", query.city)
      if (query.festival) params.set("festival", query.festival)
      if (query.offset) params.set("offset", String(query.offset))
      return (await json<{ data: MapPage }>(`/api/culture/map?${params}`, { signal })).data.data
    },
    async eventContext(id: string, signal?: AbortSignal) {
      return (await json<{ data: { event: CulturalEvent; catalog: CultureCatalog } }>(`/api/culture/events/${encodeURIComponent(id)}`, { signal })).data.data
    },
    async catalog(from?: string, signal?: AbortSignal, city?: string, offset?: number): Promise<{ data: CultureCatalog; offline: boolean }> {
      const result = await json<CatalogResult>(catalogPath(from, city, offset), { signal })
      if (!result.data.data) throw new CultureApiError(503, "unavailable", result.data.error ?? "Agenda no disponible.")
      return { data: result.data.data, offline: result.response.headers.get("X-Culture-Offline") === "1" }
    },
    async event(token: string, id: string) {
      return versionedEvent(`/api/v1/events/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
    },
    async events(token: string, options: { cursor?: string; limit?: number; externalId?: string } = {}) {
      const params = new URLSearchParams()
      if (options.cursor) params.set("cursor", options.cursor)
      if (options.limit) params.set("limit", String(options.limit))
      if (options.externalId) params.set("external_id", options.externalId)
      return (await json<{ data: CulturalEvent[]; nextCursor: string | null }>(`/api/v1/events${params.size ? `?${params}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      })).data
    },
    async saveEvent(token: string, input: EventInput, existing?: { id: string; etag: string }) {
      return versionedEvent(`/api/v1/events${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, {
        method: existing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(existing ? { "If-Match": existing.etag } : {}) },
        body: JSON.stringify(input),
      })
    },
  }
}
