export const REFRESH_INTERVAL_MS = 60_000
const JITTER_MS = 15_000

/** Keep fresh server data on mount and spread clients across a 15-second window. */
export function nextRefreshDelay(
  lastAttempt: number,
  now: number,
  random = Math.random()
) {
  return (
    Math.max(0, REFRESH_INTERVAL_MS - Math.max(0, now - lastAttempt)) +
    Math.floor(random * JITTER_MS)
  )
}
