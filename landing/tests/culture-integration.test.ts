import { test } from "node:test"
import assert from "node:assert/strict"
import { parseIntegrationEvent, parseEventPage, eventEtag, matchVersion, instant } from "../src/features/culture/domain/integration.ts"
import { cultureOpenApi } from "../src/features/culture/domain/openapi.ts"
import { event } from "./culture-fixtures.ts"

function input() {
  const { id, city_id, updated_at, source, ...data } = event({ external_id: "municipal-42", publication: "draft" })
  void id; void city_id; void updated_at; void source
  return data
}
test("integration and admin share content validation without timezone truncation", () => {
  const data = input()
  data.starts_at = "2027-07-25T20:00:00.123456+02:00"
  const result = parseIntegrationEvent(data)
  assert.equal(result.starts_at, data.starts_at)
  assert.equal(result.translations.ca.title, data.translations.ca.title)
  assert.equal(result.publication, "draft")
  assert.equal(parseIntegrationEvent({ ...data, starts_at: "2027-07-25T18:00:01Z", ends_at: "2027-07-25T18:00:02Z" }).ends_at, "2027-07-25T18:00:02Z")
})
test("integration rejects read-only fields and malformed translation types", () => {
  for (const field of ["id", "city_id", "source", "updated_at", "created_at", "can_publish"]) assert.throws(() => parseIntegrationEvent({ ...input(), [field]: "injected" }), /read-only/)
  assert.throws(() => parseIntegrationEvent({ ...input(), translations: { ca: { title: 42, summary: "text" } } }), /string/)
  assert.throws(() => parseIntegrationEvent({ ...input(), translations: { ca: input().translations.ca, fr: {} } }), /Unsupported/)
  assert.throws(() => parseIntegrationEvent({ ...input(), price: 42 }), /string/)
  assert.throws(() => parseIntegrationEvent({ ...input(), external_id: " " }), /external_id/)
})
test("JSON events enforce cancellation, HTTPS links, valid references and bounded routes", () => {
  assert.throws(() => parseIntegrationEvent({ ...input(), status: "cancelled", cancellation_reason: null }), /cancellation_reason/)
  assert.throws(() => parseIntegrationEvent({ ...input(), booking_url: "javascript:alert(1)" }), /HTTPS/)
  assert.throws(() => parseIntegrationEvent({ ...input(), place_id: "other-city-place" }), /Identificador/)
  assert.throws(() => parseIntegrationEvent({ ...input(), route: [{ lat: 200, lng: 0 }, { lat: 0, lng: 0 }] }), /coordenades/)
  assert.throws(() => parseIntegrationEvent({ ...input(), ends_at: input().starts_at }), /after/)
})
test("integration instants reject ambiguous local timestamps and rolled-over calendar dates", () => {
  for (const value of ["2027-07-25T20:00", "2027-02-30T20:00:00Z", "2027-07-25T24:00:00Z", "2027-07-25T20:60:00Z", "not-a-date", 42]) assert.throws(() => instant(value), /RFC3339/)
})
test("strong ETags preserve database microseconds and reject unsafe preconditions", () => {
  const value = "2027-07-25T18:00:00.123456+00:00"
  assert.equal(matchVersion(eventEtag(value)), value)
  for (const etag of [null, "*", `W/${eventEtag(value)}`, `${eventEtag(value)}, ${eventEtag(value)}`, '"invalid"']) assert.throws(() => matchVersion(etag))
})
test("cursor pages are bounded and reject filter injection or unknown parameters", () => {
  assert.equal(parseEventPage(new URLSearchParams()).limit, 100)
  assert.equal(parseEventPage(new URLSearchParams({ limit: "200", cursor: input().place_id })).cursor, input().place_id)
  for (const query of ["limit=0", "limit=201", "limit=1.5", "cursor=abc,publication.eq.draft", "city_id=other", "source=other"]) assert.throws(() => parseEventPage(new URLSearchParams(query)))
})
test("OpenAPI exposes strong concurrency and prohibits caller-controlled ownership", () => {
  const spec = cultureOpenApi
  assert.equal(spec.openapi, "3.1.0")
  assert.equal(spec.paths["/api/v1/events/{id}"].put.parameters[0].name, "If-Match")
  assert.equal(spec.components.schemas.EventInput.additionalProperties, false)
  for (const field of ["id", "source", "city_id", "updated_at"]) assert.equal(Object.hasOwn(spec.components.schemas.EventInput.properties, field), false)
})