const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const string = { type: "string" }
const nullableString = { type: ["string", "null"] }
const uuid = { type: "string", format: "uuid" }
const datetime = { type: "string", format: "date-time" }
const eventProperties = {
  translations: { type: "object", required: ["ca"], additionalProperties: false,
    properties: { ca: ref("EventText"), es: ref("EventText"), en: ref("EventText") } },
  starts_at: datetime, ends_at: datetime, place_id: uuid, category_id: { ...string, maxLength: 80 },
  festival_id: { type: ["string", "null"], format: "uuid" },
  format: { enum: ["timed", "exhibition"] }, publication: { enum: ["draft", "published"] },
  status: { enum: ["scheduled", "cancelled"] },
  cancellation_reason: { ...nullableString, maxLength: 1000, description: "Required and nonempty when cancelled." },
  route: { type: ["array", "null"], minItems: 2, maxItems: 500, items: { type: "object", required: ["lat", "lng"], properties: {
    lat: { type: "number", minimum: -90, maximum: 90 }, lng: { type: "number", minimum: -180, maximum: 180 },
  } } },
  image_url: { ...nullableString, format: "uri", pattern: "^https://", maxLength: 2048 },
  booking_url: { ...nullableString, format: "uri", pattern: "^https://", maxLength: 2048 },
  price: { ...string, maxLength: 160 }, organizer: { ...string, maxLength: 160 },
  accessibility: { ...string, maxLength: 2000 }, schedule_notes: { ...string, maxLength: 2000 },
  external_id: { ...string, minLength: 1, maxLength: 160 },
}
const response = (schema: object, description = "Success") => ({ description, content: { "application/json": { schema } } })
const single = { type: "object", required: ["data"], properties: { data: ref("Event") } }
const errors = Object.fromEntries([401, 403, 413, 415, 422, 429, 503].map((status) => [status, response(ref("Error"), `HTTP ${status}; see code and error. 429 includes Retry-After.`)]))
const etagHeaders = { ETag: { schema: string, description: 'Strong event version. Send verbatim as If-Match.' } }
const input = { required: true, content: { "application/json": { schema: ref("EventInput") } } }
export const cultureOpenApi = {
  openapi: "3.1.0",
  info: { title: "Mataró Cultura Integration API", version: "1.0.0", description: "Server-to-server synchronization. JWTs are dedicated Supabase Auth users registered in city_integrations. City and source come from the credential, never from the request. Public clients use GET /api/culture without authentication." },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/events": {
      get: { operationId: "listEvents", summary: "List this integration's events, including drafts", parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 100 } },
        { name: "cursor", in: "query", schema: uuid, description: "Opaque nextCursor from the previous page. Ordered by immutable UUID; not a change feed." },
        { name: "external_id", in: "query", schema: { ...string, maxLength: 160 } },
      ], responses: { "200": response({ type: "object", required: ["data", "nextCursor"], properties: {
        data: { type: "array", items: ref("Event") }, nextCursor: { type: ["string", "null"], format: "uuid" },
      } }), ...errors } },
      post: { operationId: "createEvent", summary: "Create an event; duplicate source/external_id returns 409", requestBody: input,
        responses: { "201": { ...response(single, "Created"), headers: { ...etagHeaders, Location: { schema: string } } },
          "409": response(ref("Error"), "Duplicate external ID; retrieve and update it instead."), ...errors } },
    },
    "/api/v1/events/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      get: { operationId: "getEvent", summary: "Get an owned event and its current ETag", responses: {
        "200": { ...response(single), headers: etagHeaders }, "404": response(ref("Error"), "Not found in this integration's scope."), ...errors,
      } },
      put: { operationId: "replaceEvent", summary: "Replace editable fields using optimistic concurrency", requestBody: input,
        parameters: [{ name: "If-Match", in: "header", required: true, schema: string, description: 'Exact ETag returned by GET or a previous write. Wildcards and weak ETags are rejected.' }],
        responses: { "200": { ...response(single), headers: etagHeaders }, "409": response(ref("Error"), "Duplicate external ID."),
          "412": response(ref("Error"), "Changed, missing or no longer writable. Re-fetch and reconcile; do not blindly overwrite."),
          "428": response(ref("Error"), "If-Match is missing."), ...errors } },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      EventText: { type: "object", additionalProperties: false, required: ["title", "summary"], properties: {
        title: { ...string, minLength: 1, maxLength: 160 }, summary: { ...string, minLength: 1, maxLength: 500 }, description: { ...string, maxLength: 15000 },
      } },
      EventInput: { type: "object", additionalProperties: false, required: ["translations", "starts_at", "ends_at", "place_id", "category_id", "format", "publication", "status", "external_id"], properties: eventProperties },
      Event: { type: "object", properties: { ...eventProperties, id: uuid, city_id: string, source: string, updated_at: datetime, created_at: datetime } },
      Error: { type: "object", required: ["code", "error"], properties: { code: string, error: string } },
    },
  },
} as const