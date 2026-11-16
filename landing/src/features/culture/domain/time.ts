export { dayKey, formatDate } from "../../../../../shared/culture/presentation.ts"

export function localInput(value: string, timezone = "Europe/Madrid"): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

export function validDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Reject both missing and ambiguous DST times rather than silently moving an event. */
export function toUtc(value: string, timezone = "Europe/Madrid"): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !validDay(value.slice(0, 10))
  ) {
    throw new Error("Data o hora no vàlida.")
  }
  const naive = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(naive) || Number(value.slice(11, 13)) > 23)
    throw new Error("Data o hora no vàlida.")
  const candidates: string[] = []
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(naive - offset * 60_000).toISOString()
    if (localInput(candidate, timezone) === value) candidates.push(candidate)
  }
  if (candidates.length !== 1) {
    throw new Error(
      "Hora inexistent o ambigua pel canvi d’horari. Tria una altra hora."
    )
  }
  return candidates[0]
}

