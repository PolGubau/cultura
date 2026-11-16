import { test } from "node:test"
import assert from "node:assert/strict"
import { parseProposal } from "../src/features/culture/domain/proposals.ts"

function form(patch: Record<string, string> = {}) {
  const values = { title: "Concert", summary: "Música en directe", place_name: "Plaça Major",
    starts_at: "2027-07-25T20:00", ends_at: "2027-07-25T22:00", ...patch }
  const result = new FormData()
  Object.entries(values).forEach(([key, value]) => result.set(key, value))
  return result
}

test("anonymous proposal preserves content and converts local dates", () => {
  const proposal = parseProposal(form({ booking_url: "https://example.org/acte" }), "Europe/Madrid")
  assert.equal(proposal.starts_at, "2027-07-25T18:00:00.000Z")
  assert.equal(proposal.ends_at, "2027-07-25T20:00:00.000Z")
  assert.equal(proposal.place_name, "Plaça Major")
  assert.equal(proposal.booking_url, "https://example.org/acte")
  assert.equal(proposal.description, "")
})

test("rejects missing or oversized details, unsafe URLs and invalid dates", () => {
  const invalid: Record<string, string>[] = [{ title: " " }, { summary: "x".repeat(501) }, { place_name: "" },
    { booking_url: "http://example.org" }, { booking_url: "https://user:pass@example.org" },
    { ends_at: "2027-07-25T19:00" }, { starts_at: "2027-03-28T02:30" }]
  for (const patch of invalid) {
    assert.throws(() => parseProposal(form(patch), "Europe/Madrid"))
  }
})
