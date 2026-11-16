# Cultural clients and municipal integrations

## Architecture

- `shared/culture`: framework-free domain, contract, display tokens and fetch SDK.
- `landing`: public Next.js PWA + admin + versioned HTTP API. Public requests never inherit an admin session.
- `app/src/features/culture`: native Expo screens; same backend and domain, native lists, navigation, storage, share and calendar.
- Separate dependency installs intentionally isolate React 19.1 (Expo) from React 19.2 (Next). No dependency was added or upgraded. Shared source is compiled by both tools.
- `app/`, `landing/`, and `shared/` live in the same Git repository. Build from a complete checkout; no package publication is required. On Vercel, set Root Directory to `landing` and enable source files outside it. Run EAS from `app/` with the repository root available, and verify the uploaded archive includes `shared/`. See the root README.

The new Android entry is `/(culture)`. Legacy festival screens/resources remain in source for migration, but no legacy push registration, onboarding or event fetching is mounted by the new root. Old URLs should redirect into the cultural client. Scheme/package identifiers stay compatible with existing installations.

## Configure Android

Set `EXPO_PUBLIC_CULTURE_API_URL` in `app/.env.local` to the HTTPS **origin** of the deployed PWA (no path, no trailing slash required). This is a public address, never an API key. For local Android emulator development, `http://10.0.2.2:3000` addresses the host machine; physical devices need a reachable host and production builds should use HTTPS. `EXPO_PUBLIC_MAPTILER_KEY` is optional and public. The cultural client does not use `EXPO_PUBLIC_FESTIVAL_ID`, festival dates or Expo Supabase credentials; existing legacy scripts and screens may still use their old settings. Expo and Next install separately with `pnpm install --frozen-lockfile` in each directory.

Both clients offer Agenda, Ara, Mapa, Favorits and Ajustos. Favorite IDs, locale and festival mode are local to each device, not account-synchronized. The native catalogue is restored before refresh and only successful downloads replace it. The PWA has its own service worker/offline reader. Maps and images are not guaranteed offline. A native map uses the existing MapLibre WebView renderer, not a WebView of the web application.

The interface is Catalan; event content falls back from Spanish/English to Catalan. The catalogue covers 90-day periods in pages of 1,000 events; both clients expose previous/next periods and a load-more option. List rendering is bounded/virtualized. Browser/device visual and accessibility testing remains necessary: shared design is not a claim of pixel-identical rendering on different operating systems.

## Provision a municipal integration

1. Apply migration `202611150005_integrations.sql` after migrations 001–004 in an authorized Supabase project. No remote changes are performed by creating these files.
2. Create a **dedicated** Supabase Auth user through the trusted administration workflow. Do not reuse a person's account; do not grant `city_memberships` or a service role.
3. Through trusted SQL administration, insert its UUID in `city_integrations` with `city_id = mataro`, a unique source (e.g. `municipal-agenda`), and explicit `can_write` / `can_publish` flags. Both default to false. A registry entry suppresses editor memberships even if one was accidentally granted.
4. The municipal server signs in with the existing Supabase Auth SDK. Keep credentials and refresh tokens in its secret manager. Send the short-lived access token as a Bearer header; refresh before expiry. Never embed credentials or integration tokens in Android/browser code, query strings, shell arguments, logs or example screenshots. Use HTTPS only.
5. Revoke immediately with `enabled = false`; existing unexpired JWTs then lose integration access as well. Rotate dedicated account credentials and revoke its sessions if compromised.

The API uses the **caller's JWT + database RLS**, never a service-role bypass. Integration permissions restrict city, source, writes and publication in the database too. Machine accounts cannot delete events, edit places/categories/festivals, or modify other sources. Use cancellation or draft publication instead of deleting stable URLs.

Authenticated requests consume a durable per-integration budget (default 120/minute; configurable 1–600). This is shared across server instances, not an in-memory limiter. Invalid/unauthenticated traffic must additionally be rate-limited at the hosting WAF before Auth/database work. Direct Supabase REST access is constrained by RLS but does not consume the HTTP API budget; restrict that network surface if a strict transport-wide quota is required.

## HTTP contract / DX

Import `/api/v1/openapi.json` into Postman, Insomnia or an OpenAPI client generator. Use `shared/culture/client.ts` directly for the in-repository TypeScript SDK.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/culture?from=YYYY-MM-DD` | Anonymous shared catalogue for both public clients, CDN/cache protected |
| `GET /api/culture/events/{id}` | Anonymous event + catalogue context for deep links |
| `GET /api/v1/events?limit=100&cursor=...` | Integration-owned events, drafts included; follow `nextCursor` until null |
| `GET /api/v1/events?external_id=...` | Recover the municipal ID → app ID mapping |
| `GET /api/v1/events/{id}` | Owned event and strong `ETag` response header |
| `POST /api/v1/events` | Create; returns 201, Location, ETag and the event |
| `PUT /api/v1/events/{id}` | Full replacement of editable fields; requires exact `If-Match` ETag |

JSON fields use the existing database names. Required: Catalan `translations.ca.title` and `summary`, RFC3339 `starts_at` / `ends_at` **with timezone**, `place_id`, `category_id`, `format`, `publication`, `status` and a stable nonempty `external_id`. Optional fields/defaults and limits are in OpenAPI. Discover places, categories and published festivals from the public catalogue; provision references in admin before import. There are no nested writes or inferred place names. Partial PUT bodies clear optional fields; PATCH is intentionally not supported.

City/source/IDs/timestamps are server-owned; sending them in the write body is rejected. Foreign keys cannot reference another city. All text/URLs/routes use the same validation as the admin; URLs must be HTTPS without credentials. Bodies are limited to 256 KB of actual streamed bytes.

### Safe synchronization

1. Persist each municipal `external_id` → event ID after creation. Database uniqueness on `(city_id, source, external_id)` prevents duplicate imports.
2. If POST times out, look up `external_id` before retrying. A duplicate returns **409**, not a second event; this is duplicate prevention, not cached idempotent replay.
3. Before update, GET the event and retain the **verbatim ETag**, including quotes. PUT the full editable body with `If-Match`.
4. **412** means it changed, disappeared or is no longer writable. Fetch again, reconcile with municipal/admin changes and retry intentionally. **428** means the header is missing.
5. **401** refresh authentication; **403** fix permissions; **422** fix input; **429** honor `Retry-After: 60`; **503** retry with bounded exponential backoff and jitter. Never log authentication headers.

UUID cursor paging is stable for existing records, not a transactional export or changes feed: concurrent inserts can fall before the current cursor. Periodically rescan from the first page and deduplicate by ID. Webhooks, bulk jobs, deletion feeds and OAuth client-credentials issuance are not implemented.

Writes invalidate the public data/HTML cache; existing CDN copies can persist for their short TTL and clients refresh with jitter. An accepted write is not an instant push notification. Native push/reminders were deliberately not wired to the old festival backend.

## Before production

Run the unit tests, production HTTP checks and local fixture load harness. `supabase/tests/culture-integrations.sql` provides rollback-only SQL assertions for ownership, cross-city/source access, publication, stale versions, quotas and revocation; it has not been executed here because PostgreSQL/Docker and an authorized project are unavailable. Also validate with two real integration users in a disposable database. Check token expiry, duplicate imports and simultaneous HTTP updates. Then test installed iPhone PWA and Android on devices, including airplane mode. No load test using synthetic upstream data proves a particular production Supabase/CDN capacity.
