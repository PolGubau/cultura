import "server-only"
import { revalidatePath, revalidateTag } from "next/cache"
import { integrationSession, IntegrationError } from "./integration-auth"
import { integrationBody, integrationHandler, integrationJson, databaseFailure } from "./integration-http"
import { eventEtag, matchVersion, parseEventPage, parseIntegrationEvent } from "../domain/integration"
import { uuid } from "../domain/validation"
import { PUBLIC_CACHE_TAG } from "./public-cache"

export function listIntegrationEvents(request: Request) {
  return integrationHandler(async () => {
    const session = await integrationSession(request)
    const { limit, cursor, externalId } = parseEventPage(new URL(request.url).searchParams)
    let query = session.db.from("city_events").select("*").eq("city_id", session.city_id).eq("source", session.source).order("id").limit(limit + 1)
    if (cursor) query = query.gt("id", cursor)
    if (externalId) query = query.eq("external_id", externalId)
    const result = await query
    if (result.error) databaseFailure(result.error.code)
    const data = result.data!.slice(0, limit)
    return integrationJson({ data, nextCursor: result.data!.length > limit ? data.at(-1)!.id : null })
  })
}
export function getIntegrationEvent(request: Request, id: string) {
  return integrationHandler(async () => {
    const session = await integrationSession(request)
    const result = await session.db.from("city_events").select("*").eq("city_id", session.city_id).eq("source", session.source).eq("id", uuid(id)).maybeSingle()
    if (result.error) databaseFailure(result.error.code)
    if (!result.data) throw new IntegrationError(404, "not_found", "Event not found.")
    return integrationJson({ data: result.data }, 200, { ETag: eventEtag(result.data.updated_at) })
  })
}
export function saveIntegrationEvent(request: Request, id?: string) {
  return integrationHandler(async () => {
    const session = await integrationSession(request, true)
    if (id && !request.headers.has("if-match")) throw new IntegrationError(428, "precondition_required", "Fetch the event and send its ETag in If-Match.")
    const version = id ? matchVersion(request.headers.get("if-match")) : null
    const payload = { ...parseIntegrationEvent(await integrationBody(request)), source: session.source, city_id: session.city_id }
    if (payload.publication === "published" && !session.can_publish) throw new IntegrationError(403, "forbidden", "Publishing permission is required.")
    const result = id
      ? await session.db.from("city_events").update(payload).eq("city_id", session.city_id).eq("source", session.source).eq("id", uuid(id)).eq("updated_at", version!).select("*").maybeSingle()
      : await session.db.from("city_events").insert(payload).select("*").single()
    if (result.error) databaseFailure(result.error.code)
    if (!result.data) throw new IntegrationError(412, "precondition_failed", "Event changed or is not writable. Fetch it again before retrying.")
    // Route handlers cannot call updateTag (Server Actions only).
    revalidateTag(PUBLIC_CACHE_TAG, { expire: 0 })
    revalidatePath("/", "layout")
    return integrationJson({ data: result.data }, id ? 200 : 201, { ETag: eventEtag(result.data.updated_at), Location: `/api/v1/events/${result.data.id}` })
  })
}