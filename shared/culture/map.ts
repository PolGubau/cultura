import type { MapQuery } from "./types"

/** Reject malformed or unbounded requests before they reach the database. */
export function parseMapQuery(params: URLSearchParams): MapQuery | null {
  const number = (key: string) => {
    const raw = params.get(key)
    return raw === null || raw.trim() === "" ? NaN : Number(raw)
  }
  const bounds = { west: number("west"), south: number("south"), east: number("east"), north: number("north") }
  if (Object.values(bounds).some((value) => !Number.isFinite(value)) ||
      bounds.west < -180 || bounds.east > 180 || bounds.south < -90 || bounds.north > 90 ||
      bounds.west >= bounds.east || bounds.south >= bounds.north) return null
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/
  const valid = (value: string) => dayPattern.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2200-01-01"
  const from = params.get("from") ?? ""
  const day = params.get("day") || undefined
  const city = params.get("city") || undefined
  const festival = params.get("festival") || undefined
  const offset = params.has("offset") ? number("offset") : 0
  if (!valid(from) || (day && !valid(day)) || (city && !/^[a-z0-9-]{1,80}$/.test(city)) ||
      (festival && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(festival)) ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return null
  return { bounds, from, day, city, festival, offset }
}