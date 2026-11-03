# EN-12 evidence: API gateway, rate limits, CDN

**CI run:** https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983
(workflow `Gateway`, commit `0f598810aac420697e6b567bc3e616d7103af24c`, 3 November 2026). All five jobs passed.

| Job | What it proved | Result |
|---|---|---|
| Gateway files | `npm run test:gateway`: structure of `gateway/kong.yml`, the JWKS rendering step, the CDN behaviours | passed |
| Kong configuration | `kong config parse` (kong:3.9) of the committed file and of a rendered one | passed |
| Gateway integration | 9 cards against two real Kong 3.9 containers, a shared Redis, a throwaway Postgres, the fake JWKS server and the three services | 9 of 9 passed (EN-12-T2, T3, T5 to T11) |
| CDN configuration | `terraform fmt -check`, `init -backend=false`, `validate` | passed; **nothing applied** |
| Kubernetes manifests | kustomize, kubeconform strict (Kubernetes 1.33.0), hardening check | passed; **nothing deployed** |

## What the integration job shows

- **Routing (T2):** `/identity`, `/event`, `/venue`, `/equipment` reach planning-core, `/notification` the
  notification service, `/registration` the registration service, with the prefix stripped.
- **JWT (T3):** no token, a malformed one, a forged signature, an expired token and a token under an unknown key
  id are refused by Kong (401) without reaching planning-core; a valid one passes, on both instances.
- **Separation (T5):** health, readiness and metrics paths and unknown prefixes are Kong's own 404; a staff path
  under the public prefix is not served by planning-core; sign-in is public.
- **Limits (T6, T7, T8):** with the CI limits (20 a minute per address on public routes, 15 per user on staff
  routes), request 21 (or 16) is `429` with `Retry-After`; the count is shared by two Kong instances through
  Redis (10 requests each, then 429 on both); one user at the limit does not slow another from the same address.
- **x-user-id (T9):** a client-sent value is replaced by the token's subject on staff routes and removed on public
  ones.
- **Trace headers (T10):** `traceparent` and `x-correlation-id` are generated, kept or replaced as specified,
  reach the upstream and come back.
- **Cache contract (T11):** the browse list carries `public, max-age=5, stale-while-revalidate=30`; registrations,
  `users/me` and notifications are `no-store`.

## What was not run

- **No CDN is deployed.** No AWS account was used and nothing was applied; `terraform validate` proves the file
  is well formed, not that CloudFront would serve it.
- **No cluster.** The manifests were rendered and validated, never applied.
- **The real Supabase JWKS.** Tokens were signed by a CI-only fake; a real key rotation was not exercised.
- **The committed limits (300 and 600 a minute) under traffic.** CI used 15 and 20 so a test can cross them; the
  committed values are checked in the file only.
- **Load.** EN-18 measures throughput; the gateway has not been load tested.
- **Redis failure** (`fault_tolerant: true` lets requests through) was not exercised.
