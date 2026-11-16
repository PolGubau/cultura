import { toUtc } from "./time.ts"
import { text, ValidationError } from "./validation.ts"

export function parseProposal(form: FormData, timezone: string) {
  const starts_at = toUtc(text(form, "starts_at", 16, true), timezone)
  const ends_at = toUtc(text(form, "ends_at", 16, true), timezone)
  if (ends_at <= starts_at) throw new ValidationError("El final ha de ser posterior a l’inici.")
  const rawUrl = text(form, "booking_url", 2048)
  let booking_url: string | null = null
  if (rawUrl) {
    try {
      const url = new URL(rawUrl)
      if (url.protocol !== "https:" || url.username || url.password) throw new Error()
      booking_url = url.toString()
    } catch { throw new ValidationError("L’enllaç ha de ser HTTPS i no pot contenir credencials.") }
  }
  return {
    title: text(form, "title", 160, true), summary: text(form, "summary", 500, true),
    description: text(form, "description", 5000), place_name: text(form, "place_name", 160, true),
    organizer: text(form, "organizer", 160), booking_url, starts_at, ends_at,
  }
}

export type Proposal = ReturnType<typeof parseProposal> & {
  id: string
  city_id: string
  created_at: string
}