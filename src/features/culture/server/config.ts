import "server-only"

// One deployment, one city. Later resolve this from a verified domain mapping here.
export const CITY_ID = process.env.CULTURE_CITY_ID || "mataro"
export const APP_LABEL = "Agenda cultural de Mataró"
export const FALLBACK_CITY = {
  id: CITY_ID,
  name: "Mataró",
  timezone: "Europe/Madrid",
  latitude: 41.5381,
  longitude: 2.4447,
}
export const hasDatabase = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
