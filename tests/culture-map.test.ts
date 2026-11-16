import { test } from "node:test"
import assert from "node:assert/strict"
import { parseMapQuery } from "../../shared/culture/map.ts"
import { createCultureClient } from "../../shared/culture/client.ts"

const params = () => new URLSearchParams({ west: "1", south: "41", east: "3", north: "43", from: "2027-07-01" })
test("map validates viewport, dates, filter IDs and bounded pagination", () => {
  assert.deepEqual(parseMapQuery(params()), { bounds: { west: 1, south: 41, east: 3, north: 43 }, from: "2027-07-01", day: undefined, city: undefined, festival: undefined, offset: 0 })
  for (const [key, value] of [["west", ""], ["west", "NaN"], ["east", "-2"], ["north", "91"], ["from", "2027-02-29"], ["day", "2027-13-01"], ["city", "x,other"], ["festival", "not-a-uuid"], ["offset", "-1"], ["offset", "100001"]]) {
    const input = params(); input.set(key, value)
    assert.equal(parseMapQuery(input), null, `${key}=${value}`)
  }
})
test("map client sends viewport and filters anonymously and retains pagination", async () => {
  const controller = new AbortController()
  const client = createCultureClient("https://culture.invalid", async (url, init) => {
    const input = new URL(String(url))
    assert.equal(input.pathname, "/api/culture/map")
    assert.equal(input.searchParams.get("city"), "girona")
    assert.equal(input.searchParams.get("festival"), "33333333-3333-4333-8333-333333333333")
    assert.equal(input.searchParams.get("offset"), "200")
    assert.equal(input.searchParams.get("day"), "2027-07-25")
    assert.equal(input.searchParams.get("west"), "1")
    assert.equal(init?.headers, undefined)
    assert.ok(init?.signal)
    return Response.json({ data: { events: [], nextOffset: 400 } })
  })
  const result = await client.mapEvents({ bounds: { west: 1, east: 3, south: 41, north: 43 }, from: "2027-07-01", city: "girona", festival: "33333333-3333-4333-8333-333333333333", day: "2027-07-25", offset: 200 }, controller.signal)
  assert.equal(result.nextOffset, 400)
})