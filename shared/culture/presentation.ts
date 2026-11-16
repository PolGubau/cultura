export const cultureTheme = {
  primary: "#C41E3A", background: "#FAF8F5", surface: "#FFFFFF",
  text: "#1A1110", muted: "#776C6A", border: "#E4DDD6", live: "#007A5A",
} as const
export const cultureNavigation = [
  { path: "/", title: "Agenda", icon: "calendar" },
  { path: "/ara", title: "Ara", icon: "zap" },
  { path: "/mapa", title: "Mapa", icon: "map" },
  { path: "/favorits", title: "Favorits", icon: "heart" },
  { path: "/ajustos", title: "Ajustos", icon: "settings" },
] as const
export function dayKey(value: Date | string, timezone = "Europe/Madrid"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}
export function formatDate(value: string, timezone: string, locale = "ca"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}