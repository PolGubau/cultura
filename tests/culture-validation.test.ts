import { test } from "node:test"
import assert from "node:assert/strict"
import { eventForm } from "./culture-fixtures.ts"
import {
  parseAnnouncement,
  parseCategory,
  parseEvent,
  parseFestival,
  parsePlace,
  ValidationError,
} from "../src/features/culture/domain/validation.ts"

test("manual city event can be a draft without a festival or optional translations", () => {
  const result = parseEvent(eventForm(), "Europe/Madrid")
  assert.equal(result.festival_id, null)
  assert.equal(result.publication, "draft")
  assert.equal(result.starts_at, "2027-07-25T18:00:00.000Z")
  assert.equal(result.translations.es, undefined)
})

test("required content and partial translations are rejected", () => {
  assert.throws(
    () => parseEvent(eventForm({ ca_title: " " }), "Europe/Madrid"),
    ValidationError
  )
  assert.throws(
    () => parseEvent(eventForm({ es_title: "Concierto" }), "Europe/Madrid"),
    /Completa/
  )
  assert.throws(
    () =>
      parseEvent(eventForm({ ca_summary: "x".repeat(501) }), "Europe/Madrid"),
    ValidationError
  )
})

test("end must follow start and time errors remain understandable validation errors", () => {
  assert.throws(
    () =>
      parseEvent(eventForm({ ends_at: "2027-07-25T19:00" }), "Europe/Madrid"),
    /posterior/
  )
  assert.throws(
    () =>
      parseEvent(eventForm({ starts_at: "2027-03-28T02:30" }), "Europe/Madrid"),
    ValidationError
  )
})

test("cancellation requires a reason and restoring clears the old reason", () => {
  assert.throws(
    () => parseEvent(eventForm({ status: "cancelled" }), "Europe/Madrid"),
    ValidationError
  )
  assert.equal(
    parseEvent(
      eventForm({ status: "cancelled", cancellation_reason: "Pluja" }),
      "Europe/Madrid"
    ).cancellation_reason,
    "Pluja"
  )
  assert.equal(
    parseEvent(eventForm({ cancellation_reason: "Pluja" }), "Europe/Madrid")
      .cancellation_reason,
    null
  )
})

test("invalid links and credentials cannot become public event links", () => {
  for (const image_url of [
    "javascript:alert(1)",
    "http://example.org/image.png",
    "https://user:pass@example.org/image.png",
  ]) {
    assert.throws(
      () => parseEvent(eventForm({ image_url }), "Europe/Madrid"),
      ValidationError
    )
  }
  assert.equal(
    parseEvent(
      eventForm({ booking_url: "https://example.org/tickets" }),
      "Europe/Madrid"
    ).booking_url,
    "https://example.org/tickets"
  )
})

test("routes require valid coordinates and bounded size", () => {
  for (const route of [
    "{}",
    "[]",
    '[{"lat":41,"lng":2}]',
    '[{"lat":91,"lng":2},{"lat":41,"lng":2}]',
    "not-json",
  ]) {
    assert.throws(
      () => parseEvent(eventForm({ route }), "Europe/Madrid"),
      ValidationError
    )
  }
  const route = [
    { lat: 41.53, lng: 2.44 },
    { lat: 41.54, lng: 2.45 },
  ]
  assert.deepEqual(
    parseEvent(eventForm({ route: JSON.stringify(route) }), "Europe/Madrid")
      .route,
    route
  )
})

test("festivals validate range, priority and brand colors", () => {
  const form = new FormData()
  for (const [key, value] of Object.entries({
    name: "Festa de prova",
    starts_on: "2027-07-25",
    ends_on: "2027-07-29",
    primary_color: "#9f1239",
    priority: "100",
    publication: "draft",
  }))
    form.set(key, value)
  assert.equal(parseFestival(form).auto_activate, false)
  form.set("priority", "101")
  assert.throws(() => parseFestival(form), ValidationError)
  form.set("priority", "0")
  form.set("ends_on", "2027-07-24")
  assert.throws(() => parseFestival(form), ValidationError)
  form.set("ends_on", "2027-07-29")
  form.set("primary_color", "red")
  assert.throws(() => parseFestival(form), ValidationError)
})

test("places reject missing or out-of-bounds coordinates", () => {
  const form = new FormData()
  form.set("name", "Lloc de prova")
  form.set("latitude", "41.53")
  form.set("longitude", "2.44")
  assert.equal(parsePlace(form).longitude, 2.44)
  form.set("latitude", "")
  assert.throws(() => parsePlace(form), ValidationError)
  form.set("latitude", "Infinity")
  assert.throws(() => parsePlace(form), ValidationError)
})

test("categories reject identifiers that cannot be used as city-scoped keys", () => {
  const form = new FormData()
  form.set("slug", "Música")
  form.set("name", "Música")
  assert.throws(() => parseCategory(form), ValidationError)
  form.set("slug", "musica")
  assert.deepEqual(parseCategory(form), { id: "musica", name: "Música" })
})

test("announcements require a valid window, severity and festival identifier", () => {
  const form = eventForm({
    title: "Avís",
    message: "Canvi de lloc",
    severity: "warning",
  })
  assert.equal(parseAnnouncement(form, "Europe/Madrid").festival_id, null)
  form.set("severity", "emergency")
  assert.throws(() => parseAnnouncement(form, "Europe/Madrid"), ValidationError)
  form.set("severity", "info")
  form.set("festival_id", "other-city")
  assert.throws(() => parseAnnouncement(form, "Europe/Madrid"), ValidationError)
})
