import { test } from "node:test"
import assert from "node:assert/strict"
import { event, festival } from "./culture-fixtures.ts"
import {
  addDays,
  dayKey,
  localInput,
  toUtc,
  validDay,
} from "../src/features/culture/domain/time.ts"
import {
  eventText,
  filterEvents,
  isLive,
  readableForeground,
  resolveFestival,
} from "../src/features/culture/domain/catalog.ts"
import { eventCalendar } from "../src/features/culture/domain/calendar.ts"

test("city dates include midnight, leap years and month boundaries", () => {
  assert.equal(dayKey("2027-07-25T22:30:00Z"), "2027-07-26")
  assert.equal(addDays("2028-02-28", 1), "2028-02-29")
  assert.equal(addDays("2027-12-31", 1), "2028-01-01")
  assert.equal(validDay("2027-02-29"), false)
  assert.equal(validDay("2028-02-29"), true)
})

test("admin times convert from city time instead of device time", () => {
  assert.equal(toUtc("2027-07-25T20:00"), "2027-07-25T18:00:00.000Z")
  assert.equal(toUtc("2027-01-25T20:00"), "2027-01-25T19:00:00.000Z")
  assert.equal(localInput("2027-07-25T18:00:00Z"), "2027-07-25T20:00")
})

test("DST gaps and duplicated hours must not silently move an event", () => {
  assert.throws(() => toUtc("2027-03-28T02:30"), /inexistent o ambigua/)
  assert.throws(() => toUtc("2027-10-31T02:30"), /inexistent o ambigua/)
  assert.throws(() => toUtc("2027-02-30T20:00"), /no vàlida/)
  assert.throws(() => toUtc("2027-07-25T25:00"), /no vàlida/)
})

test("automatic festival mode respects dates, publication and priority", () => {
  const low = festival()
  const high = festival({ id: "high", priority: 10 })
  const draft = festival({ id: "draft", priority: 100, publication: "draft" })
  const manual = festival({ id: "manual", auto_activate: false, priority: 90 })
  assert.equal(
    resolveFestival([low, high, draft, manual], "auto", "2027-07-25")?.id,
    "high"
  )
  assert.equal(resolveFestival([low], "auto", "2027-07-29")?.id, low.id)
  assert.equal(resolveFestival([low], "auto", "2027-07-30"), null)
  assert.equal(resolveFestival([low], "city", "2027-07-25"), null)
  assert.equal(resolveFestival([manual], "manual", "2027-01-01")?.id, "manual")
  assert.equal(resolveFestival([draft], "draft", "2027-07-25"), null)
})

test("live excludes cancelled events and long-running exhibitions; end is exclusive", () => {
  const now = new Date("2027-07-25T18:00:00Z")
  assert.equal(isLive(event(), now), true)
  assert.equal(isLive(event({ status: "cancelled" }), now), false)
  assert.equal(isLive(event({ format: "exhibition" }), now), false)
  assert.equal(isLive(event(), new Date("2027-07-25T20:00:00Z")), false)
})

test("search is accent-insensitive and intersects favorite, category and festival filters", () => {
  const first = event({ festival_id: "festa" })
  const second = event({
    id: "other",
    category_id: "altres",
    festival_id: null,
  })
  assert.deepEqual(
    filterEvents([first, second], {
      query: "MUSICA",
      locale: "es",
      festivalId: "festa",
      favorites: [first.id],
      category: "musica",
    }),
    [first]
  )
  assert.deepEqual(filterEvents([first], { favorites: [], locale: "ca" }), [])
  assert.equal(eventText(first, "en"), first.translations.ca)
})

test("brand color chooses a readable foreground for light and dark colors", () => {
  assert.equal(readableForeground("#ffffff"), "#111111")
  assert.equal(readableForeground("#000000"), "#ffffff")
  assert.equal(readableForeground("#9f1239"), "#ffffff")
})

test("calendar uses UTC, cancellation status and stable identity", () => {
  const item = event({ status: "cancelled" })
  const calendar = eventCalendar(item, item.translations.ca, undefined)
  assert.match(calendar, /DTSTART:20270725T180000Z\r\n/)
  assert.match(calendar, /DTEND:20270725T200000Z\r\n/)
  assert.match(calendar, /STATUS:CANCELLED\r\n/)
  assert.ok(calendar.includes(`UID:${item.id}@cultura`))
})

test("calendar escapes property injection and folds UTF-8 without splitting characters", () => {
  const item = event()
  const calendar = eventCalendar(
    item,
    {
      title: "à".repeat(100),
      summary: "Text\rSTATUS:CANCELLED\ncoma, punt; barra\\",
      description: "",
    },
    undefined
  )
  assert.equal(calendar.includes("\rSTATUS:"), false)
  assert.match(calendar, /Text\\nSTATUS:CANCELLED\\ncoma\\, punt\\; barra\\\\/)
  for (const line of calendar.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75)
  assert.ok(
    calendar.replace(/\r\n /g, "").includes(`SUMMARY:${"à".repeat(100)}`)
  )
})
