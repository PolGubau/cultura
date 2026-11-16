import "server-only"
import { ValidationError } from "../domain/validation"
import { IntegrationError } from "./integration-auth"

export function integrationJson(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization", ...headers } })
}
export async function integrationHandler(run: () => Promise<Response>) {
  try { return await run() }
  catch (error) {
    if (error instanceof ValidationError) return integrationJson({ code: "validation_error", error: error.message }, 422)
    if (error instanceof IntegrationError) return integrationJson({ code: error.code, error: error.message }, error.status, {
      ...(error.status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
      ...(error.status === 429 ? { "Retry-After": "60" } : {}),
    })
    return integrationJson({ code: "unavailable", error: "The request could not be completed. Retry later." }, 503)
  }
}
/** Bound actual streamed bytes, not just the untrusted Content-Length header. */
export async function integrationBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new IntegrationError(415, "unsupported_media_type", "Use application/json.")
  const reader = request.body?.getReader()
  if (!reader) throw new ValidationError("A JSON body is required.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 256_000) { await reader.cancel(); throw new IntegrationError(413, "payload_too_large", "Maximum JSON body size is 256 KB.") }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) }
  catch { throw new ValidationError("Malformed JSON.") }
}
export function databaseFailure(code: string): never {
  if (code === "23505") throw new IntegrationError(409, "duplicate_external_id", "This source/external_id already exists. Fetch it and update with If-Match.")
  if (code === "23503" || code === "23514") throw new ValidationError("Invalid event references or field values for this city.")
  if (code === "42501") throw new IntegrationError(403, "forbidden", "This integration cannot perform this operation.")
  throw new IntegrationError(503, "unavailable", "Database operation failed.")
}