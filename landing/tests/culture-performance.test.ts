import { test } from "node:test"
import assert from "node:assert/strict"
import { coalesce } from "../src/features/culture/server/coalesce.ts"
import { nextRefreshDelay } from "../src/features/culture/domain/refresh.ts"

test("100 simultaneous cold loads share one operation per key, not across cities or dates", async () => {
  let calls = 0
  const load = coalesce(async (key) => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 5))
    return key
  })
  const results = await Promise.all(
    Array.from({ length: 100 }, () => load("mataro:2027-07-25"))
  )
  assert.equal(calls, 1)
  assert.ok(results.every((value) => value === "mataro:2027-07-25"))
  await Promise.all([load("mataro:2027-07-26"), load("other-city:2027-07-25")])
  assert.equal(calls, 3)
  // No persistent process cache: after invalidation, the caller can load fresh data.
  await load("mataro:2027-07-25")
  assert.equal(calls, 4)
})

test("failed and synchronously thrown loads are released and can be retried", async () => {
  let calls = 0
  const load = coalesce(async () => {
    if (++calls === 1) throw new Error("upstream unavailable")
    return "recovered"
  })
  const failed = await Promise.allSettled(
    Array.from({ length: 20 }, () => load("today"))
  )
  assert.ok(failed.every((result) => result.status === "rejected"))
  assert.equal(calls, 1)
  assert.equal(await load("today"), "recovered")
  assert.equal(calls, 2)
  let syncCalls = 0
  const sync = coalesce<string>(() => {
    syncCalls++
    throw new Error("sync")
  })
  await assert.rejects(sync("today"), /sync/)
  await assert.rejects(sync("today"), /sync/)
  assert.equal(syncCalls, 2)
})

test("fresh SSR data avoids immediate refresh and clients do not all poll together", () => {
  const now = Date.parse("2027-07-25T18:00:00Z")
  assert.equal(nextRefreshDelay(now, now, 0), 60_000)
  assert.equal(nextRefreshDelay(now - 30_000, now, 0.5), 37_500)
  assert.equal(nextRefreshDelay(now - 120_000, now, 0), 0)
  assert.equal(nextRefreshDelay(now - 120_000, now, 0.5), 7_500)
  assert.ok(nextRefreshDelay(now + 10_000, now, 0.99) < 75_000)
})
