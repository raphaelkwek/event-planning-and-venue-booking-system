# EN-12, EN-19: API gateway, rate limits, CDN and the virtual waiting room (PR #89, stacks on #80)

**Timestamp:** 2026-11-03T05:50+08:00 (SGT)
**Author:** Joash
**Scope:** `gateway/` (new), `.github/workflows/gateway.yml` (new), registration service (migrations
0008 and 0009), planning-core (event module, migration event/0019), contracts, web app, one line each
of `ci.yml` and the root `package.json`.

**Deploy:** run `npm run migrate -- event` (0019) and `npm run migrate -- registration` (0008, 0009),
then deploy planning-core and the registration service together. The registration service reads
`WAITING_ROOM_SIGNING_KEY` (at least 32 characters; flagged events take no registrations without it),
and optionally `WAITING_ROOM_ADMIT_PER_SECOND` (default 100), `WAITING_ROOM_TOKEN_TTL_SECONDS`
(default 300) and `TRUST_PROXY_HOPS` (set it to the number of proxies in front, once the gateway is).
**No gateway, Redis or CDN has been deployed**: they are code, validated in CI.

## Added

- **EN-12:** Kong 3.9 in DB-less mode (`gateway/kong.yml`) with separate staff and public routes and
  upstream pools, JWT checks against the Supabase signing keys (a rendering step turns the JWKS into
  credentials keyed by `kid`, because Kong's open source `jwt` plugin cannot fetch a JWKS itself),
  per-user (300 a minute) and per-address (600 a minute) limits in Redis answering `429` with
  `Retry-After`, and `traceparent` and `x-correlation-id` on every request. The `Gateway` workflow
  parses the configuration with `kong config parse`, starts two Kong containers sharing a Redis in
  front of the three services on a throwaway Postgres, and proves routing, the token checks, the limit
  (shared across both instances), the headers and the cache rules.
- **EN-12:** the CDN as code (`gateway/cdn/terraform`, CloudFront), validated with `terraform
  validate` only, and Kong and Redis manifests (`gateway/k8s`, kubeconform). Browse routes now answer
  `Cache-Control: public, max-age=5, stale-while-revalidate=30`; everything else stays `no-store`.
- **EN-19:** an organiser can flag an event high-demand (`PUT /api/v1/events/{id}/high-demand`, event
  migration 0019), published on `event.listing-changed`. Registering for a flagged event needs a
  short-lived signed admission token (`X-Admission-Token`), refused `ADMISSION_REQUIRED` or
  `ADMISSION_EXPIRED` without one. The waiting room (`POST /api/v1/waiting-room/entries`, `GET
  .../{entryId}`) is Postgres-backed and admits N attendees a second per event (default 100, from the
  500 requests a second EN-18 tests), with queue position and estimated wait; a token is spent by the
  registration it admits. The attendee's waiting screen polls until admitted and then registers.
- New error codes `ADMISSION_REQUIRED`, `ADMISSION_EXPIRED`, `WAITING_ROOM_NOT_REQUIRED`,
  `WAITING_ROOM_UNAVAILABLE` and `WAITING_ROOM_ENTRY_NOT_FOUND`.
- `documentation/gateway.md`; cards `tests/EN-12/` and `tests/EN-19/`.

## Changed

- `ci.yml`: the notification and registration integration suites run even when planning-core's fails,
  so one failure does not hide the others.
- The web app tells an attendee in plain words when the gateway answers 401 or 429 in Kong's own body.

## Not done

- No deployment of Kong, Redis or the CDN; no cluster or AWS account was used.
- The services' own per-address limiters need `TRUST_PROXY_HOPS` (registration) or an equivalent
  (planning-core, notification) before real traffic goes through the gateway.
- N = 100 comes from EN-18's target, not a result; EN-18 should confirm or lower it. No key rotation for
  admission tokens, and no cap on the queue's length.
