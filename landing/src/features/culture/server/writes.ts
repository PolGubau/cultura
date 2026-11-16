import "server-only"
import { requireEditor } from "./auth"
import { CITY_ID } from "./config"
import {
  parseAnnouncement,
  parseCategory,
  parseEvent,
  parseFestival,
  parsePlace,
  text,
  uuid,
  ValidationError,
} from "../domain/validation"
import type { ActionResult } from "../domain/types"

const tables = {
  event: "city_events",
  festival: "city_festivals",
  place: "city_places",
  category: "city_categories",
  announcement: "city_announcements",
} as const

/** All writes use the user's JWT + RLS, and scope IDs to the server-resolved city. */
export async function saveEntity(form: FormData): Promise<ActionResult> {
  const db = await requireEditor()
  const kind = text(form, "entity", 30)
  if (!Object.hasOwn(tables, kind))
    throw new ValidationError("Tipus de registre no vàlid.")
  const entity = kind as keyof typeof tables
  const { data: city, error: cityError } = await db
    .from("cities")
    .select("timezone")
    .eq("id", CITY_ID)
    .single()
  if (cityError || !city)
    throw new Error("No es pot recuperar la configuració de la ciutat.")
  const parsers = {
    event: () => parseEvent(form, city.timezone),
    festival: () => parseFestival(form),
    place: () => parsePlace(form),
    category: () => parseCategory(form),
    announcement: () => parseAnnouncement(form, city.timezone),
  }
  const payload = parsers[entity]()
  const rawId = text(form, "id", 80)
  const id = rawId ? (entity === "category" ? rawId : uuid(rawId)) : null
  const table = tables[entity]
  const result = id
    ? await db
        .from(table)
        .update(payload)
        .eq("city_id", CITY_ID)
        .eq("id", id)
        .select("id")
        .single()
    : await db
        .from(table)
        .insert({ ...payload, city_id: CITY_ID })
        .select("id")
        .single()
  if (result.error) {
    if (result.error.code === "23503")
      return {
        error:
          "El lloc, la festa o la categoria no existeix en aquesta ciutat.",
      }
    if (result.error.code === "23505")
      return {
        error: "Ja existeix un registre amb aquest identificador o origen.",
      }
    if (result.error.code === "23514")
      return { error: "Les dades no compleixen les regles. Revisa els camps." }
    return {
      error:
        "No s’ha pogut desar. Comprova els permisos i que el registre encara existeixi.",
    }
  }
  return { success: "Canvis desats.", id: String(result.data.id) }
}

export async function duplicateEvent(id: string): Promise<ActionResult> {
  const db = await requireEditor()
  uuid(id)
  const { data, error } = await db
    .from("city_events")
    .select("*")
    .eq("city_id", CITY_ID)
    .eq("id", id)
    .single()
  if (error || !data) return { error: "Acte no trobat en aquesta ciutat." }
  const { id: _id, created_at: _created, updated_at: _updated, ...copy } = data
  void _id
  void _created
  void _updated
  const result = await db
    .from("city_events")
    .insert({
      ...copy,
      city_id: CITY_ID,
      publication: "draft",
      status: "scheduled",
      cancellation_reason: null,
      source: null,
      external_id: null,
    })
    .select("id")
    .single()
  return result.error
    ? { error: "No s’ha pogut duplicar l’acte." }
    : {
        success:
          "Còpia creada com a esborrany. Revisa les dates abans de publicar-la.",
        id: result.data.id,
      }
}
