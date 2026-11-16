import { parseEventContent, uuid, ValidationError } from "./validation.ts"
import { validDay } from "./time.ts"

const scalarFields = ["festival_id", "place_id", "category_id", "format", "image_url", "booking_url", "price", "accessibility", "schedule_notes", "organizer", "external_id", "publication", "status", "cancellation_reason"] as const
const fields = new Set<string>([...scalarFields, "translations", "route", "starts_at", "ends_at"])
export function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !validDay(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59 || !Number.isFinite(Date.parse(value))) {
    throw new ValidationError("Dates must be RFC3339 timestamps with an explicit timezone.")
  }
  return value
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Expected a JSON object.")
  return value as Record<string, unknown>
}
export function parseIntegrationEvent(input: unknown) {
  const value = record(input)
  for (const key of Object.keys(value)) if (!fields.has(key)) throw new ValidationError(`Unknown or read-only field: ${key}`)
  const form = new FormData()
  for (const key of scalarFields) {
    const item = value[key]
    if (item != null && typeof item !== "string") throw new ValidationError(`Expected a string: ${key}`)
    form.set(key, item == null ? "" : item as string)
  }
  if (typeof value.external_id !== "string" || !value.external_id.trim()) throw new ValidationError("external_id is required for safe synchronization.")
  const translations = record(value.translations)
  for (const [locale, translation] of Object.entries(translations)) {
    if (!["ca", "es", "en"].includes(locale)) throw new ValidationError(`Unsupported locale: ${locale}`)
    const text = record(translation)
    for (const key of Object.keys(text)) if (!["title", "summary", "description"].includes(key)) throw new ValidationError(`Unknown translation field: ${key}`)
    for (const key of ["title", "summary", "description"]) {
      if (text[key] != null && typeof text[key] !== "string") throw new ValidationError(`Expected a string: ${locale}.${key}`)
      form.set(`${locale}_${key}`, (text[key] as string | undefined) ?? "")
    }
  }
  form.set("route", value.route == null ? "" : JSON.stringify(value.route))
  const starts_at = instant(value.starts_at)
  const ends_at = instant(value.ends_at)
  if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new ValidationError("ends_at must be after starts_at.")
  return { ...parseEventContent(form), starts_at, ends_at }
}
export function eventEtag(updatedAt: string) { return `"${updatedAt}"` }
export function matchVersion(value: string | null): string {
  if (!value || !/^"[^" ]+"$/.test(value)) throw new ValidationError("A single strong If-Match ETag is required.")
  return instant(value.slice(1, -1))
}
export function parseEventPage(params: URLSearchParams) {
  for (const key of params.keys()) if (!["limit", "cursor", "external_id"].includes(key)) throw new ValidationError(`Unknown query parameter: ${key}`)
  const rawLimit = params.get("limit") ?? "100"
  if (!/^[0-9]{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) throw new ValidationError("limit must be between 1 and 200.")
  const cursor = params.get("cursor")
  const externalId = params.get("external_id")
  if (externalId && externalId.length > 160) throw new ValidationError("external_id is too long.")
  return { limit: Number(rawLimit), cursor: cursor ? uuid(cursor) : null, externalId }
}
