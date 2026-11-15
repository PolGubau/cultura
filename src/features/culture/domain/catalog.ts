import type { CulturalEvent, EventText, Festival, Locale } from "./types"

export function eventText(event: CulturalEvent, locale: Locale): EventText {
  return event.translations[locale] ?? event.translations.ca
}

export function resolveFestival(
  festivals: Festival[],
  mode: string,
  today: string
): Festival | null {
  if (mode === "city") return null
  const published = festivals.filter(
    (festival) => festival.publication === "published"
  )
  if (mode !== "auto")
    return published.find((festival) => festival.id === mode) ?? null
  return (
    published
      .filter(
        (festival) =>
          festival.auto_activate &&
          festival.starts_on <= today &&
          festival.ends_on >= today
      )
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ??
    null
  )
}

export function isLive(event: CulturalEvent, now: Date): boolean {
  return (
    event.status !== "cancelled" &&
    event.format === "timed" &&
    new Date(event.starts_at) <= now &&
    new Date(event.ends_at) > now
  )
}

export function readableForeground(hex: string): "#ffffff" | "#111111" {
  const rgb = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  return (luminance + 0.05) / 0.055 > 1.05 / (luminance + 0.05)
    ? "#111111"
    : "#ffffff"
}

export function filterEvents(
  events: CulturalEvent[],
  options: {
    festivalId?: string | null
    query?: string
    category?: string
    favorites?: string[]
    locale: Locale
  }
): CulturalEvent[] {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
  const query = normalize(options.query?.trim() ?? "")
  return events.filter((event) => {
    const text = eventText(event, options.locale)
    return (
      (!options.festivalId || event.festival_id === options.festivalId) &&
      (!options.category || event.category_id === options.category) &&
      (!options.favorites || options.favorites.includes(event.id)) &&
      (!query ||
        normalize(`${text.title} ${text.summary} ${event.organizer}`).includes(
          query
        ))
    )
  })
}
