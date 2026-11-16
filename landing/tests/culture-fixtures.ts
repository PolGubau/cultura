import type {
  CulturalEvent,
  Festival,
} from "../src/features/culture/domain/types.ts"

export function event(patch: Partial<CulturalEvent> = {}): CulturalEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    city_id: "mataro",
    festival_id: null,
    place_id: "22222222-2222-4222-8222-222222222222",
    category_id: "musica",
    translations: {
      ca: {
        title: "Música a la plaça",
        summary: "Concert de tarda",
        description: "",
      },
    },
    starts_at: "2027-07-25T18:00:00.000Z",
    ends_at: "2027-07-25T20:00:00.000Z",
    format: "timed",
    route: null,
    image_url: null,
    booking_url: null,
    price: "Gratuït",
    accessibility: "",
    schedule_notes: "",
    organizer: "Entitat cultural",
    source: null,
    external_id: null,
    publication: "published",
    status: "scheduled",
    cancellation_reason: null,
    updated_at: "2027-07-01T10:00:00.000Z",
    ...patch,
  }
}

export function festival(patch: Partial<Festival> = {}): Festival {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Festa de prova",
    description: "",
    starts_on: "2027-07-25",
    ends_on: "2027-07-29",
    logo_url: null,
    primary_color: "#9f1239",
    auto_activate: true,
    priority: 0,
    publication: "published",
    ...patch,
  }
}

export function eventForm(patch: Record<string, string> = {}): FormData {
  const item = event()
  const values = {
    ca_title: item.translations.ca.title,
    ca_summary: item.translations.ca.summary,
    starts_at: "2027-07-25T20:00",
    ends_at: "2027-07-25T22:00",
    place_id: item.place_id,
    category_id: item.category_id,
    format: "timed",
    publication: "draft",
    status: "scheduled",
    ...patch,
  }
  const form = new FormData()
  Object.entries(values).forEach(([key, value]) => form.set(key, value))
  return form
}
