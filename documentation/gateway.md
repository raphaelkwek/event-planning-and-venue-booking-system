# The API gateway, rate limits and CDN (EN-12)

ADR-0011 puts one edge in front of the services: Kong checks the Supabase token, limits each user and each
address in Redis, stamps trace headers and routes requests, with a CDN in front for the web app and the
attendee browse list. This page says how the pieces work, how to run and validate them, and, plainly,
what has and has not been done.

## Status: what is built, validated, demonstrated and not run

| Part | Built | Validated | Demonstrated in CI | Not run |
|---|---|---|---|---|
| Kong configuration (`gateway/kong.yml`) | yes | `kong config parse` on the committed file and on a rendered one; node tests of its structure | routing, JWT, limits, headers against a real Kong 3.9 | production traffic |
| JWT against the Supabase keys | yes (a rendering step, see below) | node tests of the JWK to credential step | tokens signed by a **fake** JWKS server are accepted or refused | the **real** Supabase project's keys and a real rotation |
| Rate limits in Redis | yes | structure test (300 a minute per user, 600 a minute per address, Redis policy) | the limits trip, `Retry-After` is sent, two Kong instances share one count (CI uses 15 and 20 a minute) | the committed 300 and 600 under traffic, Redis failure, load (EN-18) |
| Trace headers | yes | structure test | generated or propagated, and seen at an echo upstream and at the real services | an OpenTelemetry collector |
| Staff and public routes | yes | structure test | public routes cannot reach planning-core; no health endpoint is reachable | |
| CDN (`gateway/cdn/terraform`, CloudFront) | yes, as code | `terraform fmt -check`, `terraform validate`, node tests of the behaviours | the cache headers the CDN relies on, as sent through Kong | **No CDN is deployed. No AWS account was used. Nothing was applied.** |
| Kubernetes manifests (`gateway/k8s`) | yes, as code | kustomize, kubeconform (strict), a hardening check | | **No cluster exists. Nothing was deployed.** |

## How a request travels

```
browser -> CDN -> load balancer -> Kong (2+ pods) -> planning-core | notification | registration
                                       |
                                    Redis (the rate-limit counts)
```

The web app calls one origin with a prefix per service (`frontend/src/api`, `frontend/vite.config.ts`). Kong
strips the prefix, as the dev server does, so no service needs CORS.

| Kong route | Service | Kind | Plugins |
|---|---|---|---|
| `/identity/api/v1/auth` (POST) | planning-core (`public-planning-core` pool) | public | per-address limit |
| `/identity/api/v1`, `/event/api/v1`, `/venue/api/v1`, `/equipment/api/v1` | planning-core (`staff-planning-core` pool) | staff | `jwt`, per-user limit, `Cache-Control: no-store` |
| `/notification/api/v1` | notification (`staff-notification` pool) | staff | the same |
| `/registration/api/v1` (browse, register, withdraw, my registrations, and the waiting room of EN-19) | registration (`public-registration` pool) | public | per-address limit |

- **Only `/api/v1` is routed.** `/healthz`, `/readyz` and any metrics path answer 404 at Kong: probes talk to the
  pods, not to the edge. Each Kong service has `path: /api/v1`, so nothing outside the API is reachable through
  a prefix.
- **Staff and public traffic use different Kong services and different upstream pools**, even where both reach
  planning-core (sign-in is public because no token exists yet). A public route can never be made to reach a
  staff upstream by editing the other's plugins, and the pools can be scaled or drained separately.
- **The services check the token themselves too** (implementation.md §6). Kong is the first check and the
  limit, not the only one. The public registration routes carry no `jwt` plugin at Kong: the service verifies the
  token locally against the same JWKS, and the per-address limit counts every request, including ones with no or
  a bad token, before any work is done.

## Tokens: why there is a rendering step

Kong's open-source `jwt` plugin checks a token against **credentials stored in Kong**. It cannot fetch a JWKS;
the plugin that does (`openid-connect`) is Kong Enterprise. So `gateway/scripts/render-config.mjs` reads the
Supabase JWKS and writes each key into the configuration as a credential, keyed by the key's `kid`
(`rsa_public_key` holds the PEM, `algorithm` is `ES256` or `RS256`). The plugin is set to look the credential up
by the `kid` in the token's header (`key_claim_name: kid`), and to check `exp`.

This is **a sync, not live JWKS fetching**:

- In Kubernetes an init container renders the file when a pod starts (`gateway/k8s/kong.yaml`).
- After Supabase rotates its signing keys, tokens signed by the new key are refused until the file is rendered
  again, so run `kubectl rollout restart deploy/kong`. A rolling restart keeps the gateway up. During the usual
  rotation overlap Supabase publishes both keys, so both are rendered. A scheduled restart (a CronJob) is the
  cheap safety net; it was not built.
- The script fails, rather than write a configuration that accepts nothing, if the JWKS has no keys, a key has no
  `kid`, or a key is not RSA or EC.
- If Kong Enterprise were bought, `openid-connect` would replace the rendering step.

The committed `gateway/kong.yml` holds no key. It parses on its own (`kong config parse`) and refuses every staff
request until rendered. Its one marker line (`# @@JWT_SECRETS@@`) is where the credentials go.

```bash
node gateway/scripts/render-config.mjs \
  --jwks-url "$SUPABASE_JWKS_URL" --redis redis:6379 --out /config/kong.yml
# CI also passes --planning-core/--notification/--registration host:port, --staff-limit, --public-limit and --with-ci-echo
```

## Rate limits

| Traffic | Counted by | Limit | Where it lives |
|---|---|---|---|
| Staff routes | the token's subject (`x-user-id`, see below) | 300 a minute | Redis |
| Public routes | client address | 600 a minute | Redis |

- Both use the `rate-limiting` plugin with `policy: redis`, so every Kong pod sees the same count. If Redis is
  down the plugin lets requests through (`fault_tolerant: true`): availability over a limit, a deliberate choice.
- **Why 600 a minute per address on public routes.** Attendees on a campus share one address behind NAT, and
  the waiting room (EN-19) is polled about every 2 seconds, 30 a minute per waiting attendee. 600 leaves room
  for about twenty of them on one address while still stopping a script.
- **Why 300 a minute per user for staff.** A person clicking through screens makes a handful of calls a second
  at worst.
- **Per user, not per consumer.** Kong's own "consumer" is the owner of a signing key here, not a person. A
  `pre-function` plugin reads the verified token's `sub` and sets `x-user-id`, and the limit counts by that
  header. It **always removes any `x-user-id` the client sent**, and sets one only on staff services (named
  `staff-*`), so a client cannot choose its own counter. Public services get none. The JWT check runs after the
  header is set and refuses a token that does not verify, so only a verified `sub` is ever counted.
- A refusal is `429` with a `Retry-After` header (whole seconds). **Deviation from the error envelope
  (implementation.md §5):** Kong writes its own refusals (`401`, `404`, `413`, `429`) as `{"message": "..."}`, not
  `{"error": {"code": ...}}`. The services' envelope is used for everything a service refuses. The web app
  handles the gateway's by status.
- The services keep their own per-address limiters (CodeQL requires a limiter on every route). **Behind Kong,
  every request reaches a service from Kong's address**, so those in-service limiters would count all users
  together. Before the gateway carries real traffic, either set Express's `trust proxy` for the registration,
  planning-core and notification services (so the address is the client's), or raise their limits. This was not
  changed here (it is in the services' code, not the gateway's), and the integration job does not show it
  because every request there comes from one address anyway. See "Judgement calls" below.
- The CI job renders the configuration with a staff limit of 15 and a public limit of 20 a minute so a test can
  cross them in seconds. The committed 300 and 600 are checked in the file, not by traffic.

Behind the CDN and a load balancer the client address is in `X-Forwarded-For`. `gateway/k8s/kong.yaml` sets
`KONG_REAL_IP_HEADER=X-Forwarded-For`, `KONG_REAL_IP_RECURSIVE=on` and `KONG_TRUSTED_IPS=10.0.0.0/8`. The last
is a **placeholder**: it must list only the load balancer's range and CloudFront's published address list, or a
client can pick its own address and so its own rate-limit key.

## Trace headers

- `x-correlation-id`: the `correlation-id` plugin keeps the caller's, or makes a UUID, sends it to the service
  and returns it in the response (the services already log it, implementation.md §9).
- `traceparent` (W3C): made in the same `pre-function`. A valid incoming one keeps its trace id, flags and gets a
  new span id; a missing or malformed one (or an all-zero trace id) is replaced by a fresh trace. It is sent to
  the service and returned in the response. **Kong's `opentelemetry` plugin was not used:** it is useful with a
  collector (none exists yet, EN-17) and its propagation settings differ between Kong releases, so a small
  readable Lua snippet was safer. When EN-17 adds a collector, switching is a configuration change.
- The one Lua snippet needs `KONG_UNTRUSTED_LUA=on`. That is acceptable here because the Admin API is off
  (`KONG_ADMIN_LISTEN=off`; DB-less Kong is configured by its file only) and the file comes from git, not from a
  request.

## CDN

`gateway/cdn/terraform` describes a CloudFront distribution. **No CDN is deployed and nothing was applied; no
AWS account was used.** CI runs `terraform fmt -check`, `terraform init -backend=false` and `terraform validate`,
and node tests read the behaviours. That proves the file is well formed and says what it caches. It does not
prove CloudFront serves it, that the certificate or bucket names exist, or what it costs.

| Path (viewer) | Origin | Caching |
|---|---|---|
| `/registration/api/v1/open-events*` | gateway | the only cached API path: GET and HEAD only, **at most 5 seconds**, no cookies or headers in the key, only `cursor` and `limit` query strings |
| `/registration/*`, `/identity/*`, `/event/*`, `/venue/*`, `/equipment/*`, `/notification/*` | gateway | **never cached** (`Managed-CachingDisabled`), every method, all viewer headers forwarded. Registering, withdrawing, my registrations, the waiting room and every staff call are here |
| `/assets/*` | S3 | fingerprinted files: long life (`public, max-age=31536000, immutable`, which `frontend/nginx.conf` of #75 already sends) |
| anything else | S3 | the web app; `index.html` is `no-cache`; a CloudFront Function serves `index.html` for routes with no file extension |

The cache-control contract:

- The registration service answers `GET /api/v1/open-events` and `/open-events/{id}` with
  `Cache-Control: public, max-age=5, stale-while-revalidate=30`, and everything else under `/api/` with
  `no-store`. Kong adds `Cache-Control: no-store` to every staff response that does not set its own.
- **The browse API must never cache personal data.** The browse payload is the published listing (name,
  description, times, venues, places remaining), the same for everyone. The caller's own registrations are a
  different, uncached path.
- **Judgement call for review.** The CDN's cache key does not include the `Authorization` header, so while a
  browse response is cached (5 seconds, plus up to 30 while it is refreshed) a request with **no token** can be
  answered from the cache, although the service itself would refuse it with `401`. The data is public listing
  data, which is the point of caching it, but a reviewer may prefer a stricter rule (include the header in the
  key, which gives up sharing, or serve the list without sign-in). Registering is not affected: `POST
  /registrations` always goes live and always checks.

## Kubernetes

`gateway/k8s` has Kong (2 pods, hardened like the other services in #75: non-root, read-only root filesystem,
probes, requests and limits, a PodDisruptionBudget and an HPA) and a single Redis. **Nothing is deployed.** The
Redis is a stand-in: one in-memory instance with no persistence; a lost Redis resets the counts. A managed Redis
is the production answer. The folder sits beside `deploy/` because #75 (EN-10) has not merged; once it has, the
folder can move under `deploy/k8s` and join its kustomization. Render with:

```bash
kubectl kustomize --load-restrictor LoadRestrictionsNone gateway/k8s
```

The flag is needed because the ConfigMap is built from `gateway/kong.yml` and the rendering script, which sit
outside the folder. A NetworkPolicy that lets only Kong reach the three services belongs with their manifests in
`deploy/` and was not written here (a note for EN-10, not a change to it): until it exists, an endpoint that can
be reached directly bypasses the gateway, which is what ADR-0011 tells a reviewer to watch for.

## Running and validating

| What | How | Needs |
|---|---|---|
| Node tests (file structure, rendering, CDN behaviours) | `npm run test:gateway` (also part of `npm run test:unit`) | Node only |
| Parse the configuration | the `Kong configuration` job: `docker run kong:3.9 kong config parse gateway/kong.yml` | Docker (CI only, ADR-0012) |
| Integration | the `Gateway integration` job of `.github/workflows/gateway.yml` | CI |
| Terraform | the `CDN configuration` job | CI |
| Manifests | the `Kubernetes manifests` job, or `kubectl kustomize` locally | `kubectl` |

The integration job builds a throwaway Postgres with `npm run migrate:all`, starts a Redis, the fake JWKS
server (`gateway/ci/fake-jwks.mjs`, adapted from EN-14's fake Supabase Auth; **CI only**, it refuses to start
beside any non-loopback database), planning-core, notification and the registration service, a CI echo upstream
that is added to the **rendered** configuration only, and two Kong containers on ports 8000 and 8100 that share
the Redis. It never touches the team's Supabase project. Local development does not use Docker or Kong:
`npm run dev` and the Vite proxy are unchanged.

## Judgement calls a reviewer should check

1. **JWKS sync instead of live JWKS** (above): honest but not as good as Enterprise's plugin.
2. **`pre-function` Lua with `KONG_UNTRUSTED_LUA=on`**, for the per-user key and `traceparent`.
3. **Public registration routes have no `jwt` plugin**, so the per-address limit also counts unauthenticated
   floods, and the service does the verification.
4. **In-service limiters see Kong's address** (see Rate limits): needs `trust proxy` before real traffic.
5. **A CDN hit on the browse list can answer a request with no token** for a few seconds (see CDN).
6. **Kong's own refusals are not in the error envelope.**
7. **Fail-open limits**: `fault_tolerant: true`.
8. **`/registration/*` is uncached as a whole** at the CDN, so a future registration route cannot be cached by
   accident.

## Waiting room (EN-19)

*(Added with EN-19.)*
