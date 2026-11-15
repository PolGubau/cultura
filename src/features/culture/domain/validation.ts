import { toUtc, validDay } from "./time.ts"
import type { CulturalEvent, EventText, Locale } from "./types"

export class ValidationError extends Error {}

export function text(
  form: FormData,
  key: string,
  max = 500,
  required = false
): string {
  const raw = form.get(key)
  if (raw !== null && typeof raw !== "string")
    throw new ValidationError(`Camp invàlid: ${key}`)
  const value = (raw ?? "").trim()
  if ((required && !value) || value.length > max)
    throw new ValidationError(`Revisa el camp ${key} (màxim ${max} caràcters).`)
  return value
}

export function choice<T extends string>(
  form: FormData,
  key: string,
  values: readonly T[]
): T {
  const value = text(form, key)
  if (!values.includes(value as T))
    throw new ValidationError(`Opció no vàlida: ${key}`)
  return value as T
}

export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new ValidationError("Identificador no vàlid.")
  }
  return value
}

function optionalUrl(form: FormData, key: string): string | null {
  const value = text(form, key, 2048)
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error()
    return url.toString()
  } catch {
    throw new ValidationError(
      `L’enllaç ${key} ha de ser HTTPS, sense credencials.`
    )
  }
}

function coordinate(form: FormData, key: string, max: number): number {
  const raw = text(form, key, 30, true)
  const value = Number(raw)
  if (!Number.isFinite(value) || Math.abs(value) > max)
    throw new ValidationError(`Coordenada no vàlida: ${key}`)
  return value
}

function publication(form: FormData) {
  return choice(form, "publication", ["draft", "published"] as const)
}

function dateRange(form: FormData, timezone: string) {
  try {
    const starts_at = toUtc(text(form, "starts_at", 16, true), timezone)
    const ends_at = toUtc(text(form, "ends_at", 16, true), timezone)
    if (ends_at <= starts_at)
      throw new ValidationError("El final ha de ser posterior a l’inici.")
    return { starts_at, ends_at }
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "Data o hora no vàlida."
    )
  }
}

export function parseEvent(form: FormData, timezone: string) {
  const translations: CulturalEvent["translations"] = {
    ca: { title: "", summary: "", description: "" },
  }
  for (const locale of ["ca", "es", "en"] as Locale[]) {
    const item: EventText = {
      title: text(form, `${locale}_title`, 160, locale === "ca"),
      summary: text(form, `${locale}_summary`, 500, locale === "ca"),
      description: text(form, `${locale}_description`, 15000),
    }
    if (item.title || item.summary || item.description) {
      if (!item.title || !item.summary)
        throw new ValidationError(`Completa el títol i el resum en ${locale}.`)
      translations[locale] = item
    }
  }
  const routeRaw = text(form, "route", 50000)
  let route: CulturalEvent["route"] = null
  if (routeRaw) {
    let points: unknown
    try {
      points = JSON.parse(routeRaw)
    } catch {
      throw new ValidationError(
        "El recorregut ha de ser un array JSON de punts {lat, lng}."
      )
    }
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      points.length > 500 ||
      points.some(
        (point) =>
          !point ||
          typeof point.lat !== "number" ||
          typeof point.lng !== "number" ||
          !Number.isFinite(point.lat) ||
          !Number.isFinite(point.lng) ||
          Math.abs(point.lat) > 90 ||
          Math.abs(point.lng) > 180
      )
    ) {
      throw new ValidationError(
        "El recorregut necessita entre 2 i 500 coordenades vàlides."
      )
    }
    route = points.map((point) => ({ lat: point.lat, lng: point.lng }))
  }
  const status = choice(form, "status", ["scheduled", "cancelled"] as const)
  const reason = text(form, "cancellation_reason", 1000, status === "cancelled")
  const festival = text(form, "festival_id")
  return {
    translations,
    ...dateRange(form, timezone),
    route,
    publication: publication(form),
    status,
    cancellation_reason: status === "cancelled" ? reason : null,
    festival_id: festival ? uuid(festival) : null,
    place_id: uuid(text(form, "place_id", 36, true)),
    category_id: text(form, "category_id", 80, true),
    format: choice(form, "format", ["timed", "exhibition"] as const),
    image_url: optionalUrl(form, "image_url"),
    booking_url: optionalUrl(form, "booking_url"),
    price: text(form, "price", 160),
    accessibility: text(form, "accessibility", 2000),
    schedule_notes: text(form, "schedule_notes", 2000),
    organizer: text(form, "organizer", 160),
    source: text(form, "source", 160) || null,
    external_id: text(form, "external_id", 160) || null,
  }
}

export function parseFestival(form: FormData) {
  const starts_on = text(form, "starts_on", 10, true)
  const ends_on = text(form, "ends_on", 10, true)
  if (!validDay(starts_on) || !validDay(ends_on) || ends_on < starts_on)
    throw new ValidationError("Revisa les dates de la festa.")
  const primary_color = text(form, "primary_color", 7, true)
  if (!/^#[0-9a-f]{6}$/i.test(primary_color))
    throw new ValidationError("Color no vàlid.")
  const priority = Number(text(form, "priority", 3) || "0")
  if (!Number.isInteger(priority) || priority < 0 || priority > 100)
    throw new ValidationError("Prioritat entre 0 i 100.")
  return {
    name: text(form, "name", 160, true),
    description: text(form, "description", 5000),
    starts_on,
    ends_on,
    primary_color,
    priority,
    logo_url: optionalUrl(form, "logo_url"),
    auto_activate: form.get("auto_activate") === "on",
    publication: publication(form),
  }
}

export function parsePlace(form: FormData) {
  return {
    name: text(form, "name", 160, true),
    address: text(form, "address", 500),
    latitude: coordinate(form, "latitude", 90),
    longitude: coordinate(form, "longitude", 180),
  }
}

export function parseCategory(form: FormData) {
  const id = text(form, "slug", 80, true)
  if (!/^[a-z0-9-]+$/.test(id))
    throw new ValidationError(
      "Identificador: lletres minúscules, números i guions."
    )
  return { id, name: text(form, "name", 80, true) }
}

export function parseAnnouncement(form: FormData, timezone: string) {
  const festival = text(form, "festival_id")
  return {
    title: text(form, "title", 160, true),
    message: text(form, "message", 2000, true),
    ...dateRange(form, timezone),
    publication: publication(form),
    severity: choice(form, "severity", [
      "info",
      "warning",
      "critical",
    ] as const),
    festival_id: festival ? uuid(festival) : null,
  }
}
