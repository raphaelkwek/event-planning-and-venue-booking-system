# ConnectSphere threat model (EN-23)

**Author:** Joash · **Date:** 2026-11-02 · **Jira:** EN-23 · **Companion documents:** [`pdpa.md`](pdpa.md), [`asvs-l2.md`](asvs-l2.md)

## How to read this

This is a STRIDE table for each container in the C4 model (`documentation/c4/connectsphere.dsl`). Every row names a threat, the control that **exists in the code today** with a `file:line` reference, the residual risk, and a gap or follow-up. A row whose control is `None` says so plainly, and its last column says what to do.

- Since 4 Nov 2026 every container in the C4 model is built, so no row says "not built" any more. A row whose control is `Gap` says that nothing in the repository provides it. Two things are built as code and checked in CI but run in no environment: the Kong gateway (`gateway/`) and the Kubernetes manifests (`deploy/k8s/`). Their rows say so.
- Line numbers are those of the commit this document was written against. A script test (`documentation/scripts/check-docs.test.ts`) fails when a cited line is past the end of its file. It cannot tell you that the line still says what this document says, so re-check a citation before you rely on it.
- "Fix in flight" means the gap was found on 2 Nov 2026 and another pull request is fixing it. It is recorded as a gap, not as a control.

**Scope and assumptions.** Staff-facing code is `planning-core`; attendee-facing code is the registration and notification services. Supabase Auth is an external system that the team configures but whose settings are not in the repository, so anything that depends on those settings (password rules, MFA, token lifetime) is marked as unverified, not as met. Staging and production run on one Azure VM (ADR-0016 and its Azure amendment): host Caddy terminates TLS in front of one container per environment. The Terraform, Kubernetes and Kong code is validated in CI but nothing applies it, so its controls (network policy, the gateway's JWT check) are not in force anywhere. Secret storage on the VM is a group-readable file per environment (see the Azure VM section).

**Trust boundaries.** (1) Browser to API. (2) API to Supabase Auth. (3) Services to the shared Postgres. (4) Services to Kafka. (5) Notification service to planning-core over HTTP. (6) Workers to Temporal.

## Staff console (staffConsole)

React SPA used by every internal role.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone uses a stolen bearer token. | The token is kept in `sessionStorage`, not `localStorage` (`frontend/src/api/session.ts:69`), so it goes when the tab closes. The server re-verifies the token and re-checks the user is active on every call (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:29`, `backend/services/planning-core/src/modules/identity/index.ts:40`). | An XSS bug could still read `sessionStorage`. | No Content-Security-Policy or other headers (`frontend/index.html:1`). Add them at the gateway or static host (gap G9). |
| Tampering | A user edits the client to show screens their role should not see. | The server applies the role check on every route whatever the client shows (`backend/services/planning-core/src/modules/event/auth/actor.ts:64`). The client's `roles` list only drives navigation (`frontend/src/App.tsx:64`). | Low. | None. |
| Repudiation | A user denies a change they made. | The actor comes from the verified token, never the request body (`backend/services/planning-core/src/modules/event/auth/actor.ts:28`). | Low. | None. |
| Information disclosure | A secret ships in the JavaScript bundle. | Only the Supabase URL and anon key are injected, and the anon key is public by design (`frontend/vite.config.ts:25`). | Someone later adds a service-role key to the build. | The `gitleaks` CI job scans every commit (`.github/workflows/ci.yml:213`). Keep `SUPABASE_SERVICE_ROLE_KEY` out of the frontend env. |
| Denial of service | A script floods the API through the SPA. | None in the client; the server side is covered under planning-core. | Same as planning-core. | See planning-core, gap G2. |
| Elevation of privilege | A user sends raw requests with the API console to reach other roles' functions. | The console only sends the user's own token, and the server refuses (`frontend/src/screens/ApiConsole.tsx:10`). It is open to every role by design (`frontend/src/App.tsx:193`). | It gives no extra privilege, but it is a ready-made attack tool for an insider. | Hide the console in production builds (low). |

## Attendee app (attendeeApp)

The attendee routes of the same SPA build as the staff console (R1 to R7, EN-19), served from Vercel; the API side is the registration service. The installable PWA of ADR-0014 is not built.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A bot registers under many fake accounts. | Registering needs a verified Supabase token and an identity lookup that says `ATTENDEE` (`backend/services/registration/src/api/auth.ts:70`). For a high-demand event the register call also needs a signed admission token from the waiting room (`backend/services/registration/src/service/register.ts:18`). | Gap: no email verification, CAPTCHA or invitation rule is in the repository; sign-up rules are Supabase settings that are not committed. | Decide sign-up rules before opening to the public. The waiting room slows a bot but does not tell it from a person. |
| Tampering | An attendee changes the event or pool in the request. | The body is validated: `eventId` must be a UUID, otherwise `VALIDATION_FAILED` (`backend/services/registration/src/api/routes.ts:117`). The attendee id comes from the verified caller, never the body (`backend/services/registration/src/api/routes.ts:124`). The seat claim is one SQL statement (`backend/services/registration/src/repo/seats.ts:62`). | Low. | None. |
| Repudiation | An attendee denies registering. | The seat records who and when (`backend/services/registration/migrations/0001_init_registration_schema.sql:45`); registrations are withdrawn by status, never deleted (`backend/services/registration/src/api/routes.ts:192`). | Low. | None. |
| Information disclosure | An attendee sees another attendee's registration. | Both read routes filter on the caller's id, and another attendee's registration answers exactly as one that does not exist (`backend/services/registration/src/api/routes.ts:167`, `backend/services/registration/src/api/routes.ts:184`). Responses under `/api/` are `Cache-Control: no-store` (`backend/services/registration/src/app.ts:49`). | Low. | None. |
| Denial of service | A flood of registrations at opening time. | `FOR UPDATE SKIP LOCKED` so racing claims do not queue (`backend/services/registration/src/repo/seats.ts:57`). A rate limiter runs before authentication on every route: 120 a minute per address, 240 for the waiting room (`backend/services/registration/src/api/limiter.ts:14`, `backend/services/registration/src/api/limiter.ts:33`). The waiting room admits a fixed number a second (`backend/services/registration/src/domain/waitingRoom.ts:57`). | Campus networks share addresses; a per-address limit can lock out a lecture hall. The load test is EN-18. | `TRUST_PROXY_HOPS` must match the real proxy count or every client shares the proxy's address (`backend/services/registration/src/config.ts:53`). |
| Elevation of privilege | An attendee calls staff routes. | Staff routes refuse the `ATTENDEE` role (`backend/services/planning-core/src/modules/identity/api/users.ts:37`, `backend/services/planning-core/src/modules/event/auth/actor.ts:64`). The registration service has its own `staffOnly` and `attendeeOnly` guards (`backend/services/registration/src/api/auth.ts:78`). | Gap: `policies/resources/registration.yaml` exists but the registration service does not call Cerbos; its role checks are code. | Ask the PDP from the registration service, or test the two against each other (G5). |

## API gateway (gateway)

Kong 3.9 with Redis (EN-12, ADR-0011). The declarative config, the rendering step and the CDN code exist and are exercised in CI (`.github/workflows/gateway.yml`: `kong config parse`, and an integration job with two Kong containers sharing one Redis). **No deployed environment runs it.** On the VM, Caddy routes the public prefixes straight to the services (`deploy/space/Caddyfile:14`), so the Caddy and in-process controls are in force and the Kong ones are built but dormant.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A service trusts that a request came through the gateway. | Every service verifies the token itself (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:11`). Kong's JWT plugin is an extra check only (`gateway/kong.yml:129`, dormant). | Low. | None. |
| Tampering | Headers such as `x-forwarded-for` choose the rate-limit key. | Express keeps `trust proxy` off unless `TRUST_PROXY_HOPS` is set (`backend/services/registration/src/app.ts:26`, `backend/services/planning-core/src/modules/equipment/api/limiter.ts:8`). | Behind Caddy, a wrong hop count makes every client share one address or lets a client choose its key. | Set `TRUST_PROXY_HOPS=1` in both VM env files and test it. The deploy gate accepts that setting (`deploy/azure/connectsphere-vm-deploy:30`). |
| Repudiation | Requests cannot be traced to a caller. | All three services stamp a correlation id (the trace id) on every response and log line (`backend/services/registration/src/app.ts:23`, `backend/packages/telemetry/src/http.ts:62`). Kong has a correlation-id plugin (`gateway/kong.yml:48`, dormant). | Low. | The id is taken from the client when sent (G12). |
| Information disclosure | `/metrics` or health routes are exposed to the internet. | `/metrics` is off in production without `METRICS_TOKEN` (`backend/packages/observability/src/metrics.ts:92`). Caddy routes only the listed prefixes and answers 404 to everything else, so `/metrics`, `/readyz` and the Cerbos port are not reachable from outside (`deploy/space/Caddyfile:38`). | Low. | `/healthz` answers "ok" without a token by design (`deploy/space/Caddyfile:11`). |
| Denial of service | Request floods. | In force: the in-process limiters of each service run before authentication (`backend/services/registration/src/api/limiter.ts:14`, `backend/services/notification/src/api/limiter.ts:13`, `backend/services/planning-core/src/modules/event/api/eventRateLimiter.ts:11`). Built but dormant: Kong's `rate-limiting` per user in Redis (`gateway/kong.yml:136`) and `request-size-limiting` (`gateway/kong.yml:54`). | The limits in force are per address and per process, not per user. | Gap: no request-size limit on the VM path beyond `express.json()`'s default. |
| Elevation of privilege | The gateway routes an internal path to the public. | Caddy has an allow-list of six prefixes, each stripped and sent to one port (`deploy/space/Caddyfile:14` to `deploy/space/Caddyfile:37`). Cerbos, Temporal and Redpanda listen on 127.0.0.1 only (`deploy/space/supervisord.conf:39`, `deploy/space/supervisord.conf:30`, `deploy/space/redpanda.yaml:13`). | Low. | None. |

## planning-core (core)

The staff API: identity, event, venue, equipment and change modules in one Express process.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A forged or foreign token is accepted. | Signature is checked against the project's JWKS (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:29`); a deactivated user is refused on every call (`backend/services/planning-core/src/modules/identity/index.ts:40`). | `iss`, `aud` and `alg` are not pinned. | Pass `issuer`, `audience` and `algorithms` to `jwtVerify` (G8). |
| Spoofing | Brute-force sign-in. | A 30 per minute per-address limit on login (`backend/services/planning-core/src/modules/identity/api/limiter.ts:36`) before any Supabase call (`backend/services/planning-core/src/modules/identity/api/auth.ts:23`). Supabase has its own limit. | Per-address only; a distributed attack is not slowed. | No lockout or alert on repeated failures. The audit row has no address (G13). |
| Tampering | A user changes a record they should not (broken object authorisation). | Reads and writes are scoped in SQL (`backend/services/planning-core/src/modules/event/repo/events.ts:129`, `backend/services/planning-core/src/modules/event/repo/events.ts:146`); status changes go through one guarded machine (`backend/services/planning-core/src/modules/event/domain/statusMachine.ts:96`). | `PUT /venues/:id` checks the role only, so any Venue Staff member can edit any venue (found 2 Nov, fix in flight). | `backend/services/planning-core/src/modules/venue/api/venues.ts:104` (G6). |
| Tampering | Two users double-book a venue or unit. | Exclusion constraints in the database (`backend/services/planning-core/migrations/venue/0003_venue_slots_and_unavailability.sql:72`, `backend/services/planning-core/migrations/venue/0005_booking_requests.sql:53`, `backend/services/planning-core/migrations/equipment/0001_equipment_inventory.sql:75`). | Low. | None. |
| Repudiation | A staff member denies an action. | Login outcomes are audited (`backend/services/planning-core/src/modules/identity/api/auth.ts:72`); status history and per-module history tables record who and when; log lines carry the correlation id (`backend/services/planning-core/src/app.ts:31`). | The audit has no source address, and the logs are on stdout only. | Add address and user agent to `login_audit`; ship logs off the host (EN-08). |
| Information disclosure | Errors reveal internals. | Refusals use one envelope with a code (`backend/services/planning-core/src/modules/event/api/errors.ts:12`). | `/readyz` returns the raw database error to any caller, and the default Express error handler prints stack traces when `NODE_ENV` is not production (found 2 Nov, fix in flight). | `backend/services/planning-core/src/shared/health.ts:30`, `backend/services/planning-core/src/app.ts:51` (G3). |
| Information disclosure | Staff look up other users' emails. | Only non-attendee roles, and only by user id, 100 at a time (`backend/services/planning-core/src/modules/identity/api/users.ts:37`). | Any staff role can read any user's name and email. | Limit the lookup to ids the caller already sees (low). |
| Denial of service | A flood, or one failing dependency, takes the process down. | Per-module rate limits on most routes (`backend/services/planning-core/src/modules/equipment/api/limiter.ts:11`). | 17 event-module routes have no limiter, and there is no error middleware or `unhandledRejection` handler, so a rejected promise in an async handler crashes the process on Node 20 (found 2 Nov, fix in flight). | `backend/services/planning-core/src/modules/event/api/events.ts:46`, `backend/services/planning-core/src/app.ts:51`, `backend/services/planning-core/src/index.ts:46` (G1, G2). |
| Denial of service | A Supabase call hangs. | None. | The login and logout `fetch` calls have no timeout. | `backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:15` (G11). |
| Elevation of privilege | A role calls another role's function. | `requireRole` on 70 call sites, with the permitted list per route (`backend/services/planning-core/src/modules/event/auth/actor.ts:64`). | The Cerbos policies in `policies/` are tested but never called at runtime, and there is no row-level security. Authorisation lives only in application code. | `policies/README.md:5` says so. Wire Cerbos (EN-07) or accept the role checks as the control (G5). |

## registration-service (registration)

Seat inventory. Only health and metrics routes exist; the registration routes arrive with R2.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A forged "booking approved" message builds seats. | Messages are validated against the CloudEvent schema (`backend/services/registration/src/consumer/handleApproval.ts:32`) and the connection is TLS with SASL (`backend/packages/kafka/src/config.ts:46`). | The `actor` field is unsigned, and any holder of the Kafka credentials can publish on the topic. | Per-service Kafka credentials and ACLs; consider signing messages (G7). |
| Tampering | A message is delivered twice, or two attendees race for the last seat. | The inbox primary key makes a duplicate a no-op (`backend/services/registration/src/consumer/handleApproval.ts:44`), and the claim is a single `FOR UPDATE SKIP LOCKED` statement (`backend/services/registration/src/repo/seats.ts:62`). | Low. | None. |
| Tampering | A seat is claimed without a holder, or a seat number repeats. | A CHECK and a UNIQUE constraint (`backend/services/registration/migrations/0001_init_registration_schema.sql:44`, `backend/services/registration/migrations/0001_init_registration_schema.sql:45`), watched by the over-admission gauge (`backend/services/registration/src/overAdmission.ts:20`). | Low. | None. |
| Repudiation | Who claimed which seat is unclear. | `claimed_by`, `claimed_at` and `updated_by` on each seat (`backend/services/registration/src/repo/seats.ts:67`). | Low. | None. |
| Information disclosure | Seat data leaks attendee identities. | Seats hold a user id only, no name or email (`backend/services/registration/migrations/0001_init_registration_schema.sql:25`). `/readyz` returns the raw database error (`backend/services/registration/src/health.ts:23`). | Low for seats; medium for the error text. | Return a fixed message from `/readyz` (G3). |
| Denial of service | An approval with a huge layout capacity inserts that many rows. | None: the capacity must be a positive integer with no upper bound, and the insert is `generate_series(1, capacity)`. | A buggy or tampered message can fill the database. | `backend/packages/contracts/src/venueBooking.ts:81`, `backend/services/registration/src/repo/seats.ts:34`. Add a maximum (G4). |
| Elevation of privilege | The service reads another service's schema. | Reviewed by convention and CI for planning-core only (`npm run lint:boundaries`). The registration database connection is one credential for the whole schema (`backend/services/registration/src/db.ts:4`). | Medium: nothing in the database stops a cross-schema read. | Use a database role per service with grants on its own schema only (G5). |

## notification-service (notification)

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A caller reads someone else's notifications by presenting another token. | Each request resolves the caller by asking planning-core with the caller's own token, with a 5 second timeout (`backend/services/notification/src/api/auth.ts:12`, `backend/services/notification/src/api/identity.ts:41`). | The call goes over `http://` by default. | `backend/services/notification/src/config.ts:18`: require HTTPS in production (G10). |
| Tampering | A poison or forged message corrupts state. | Validation, a retry limit of 3 and a dead-letter topic (`backend/services/notification/src/consumer/handleMessage.ts:60`, `backend/services/notification/src/domain/retryPolicy.ts:8`); the inbox row and the notifications share one transaction (`backend/services/notification/src/consumer/handleMessage.ts:99`). | Same Kafka trust gap as registration. | G7. |
| Repudiation | Delivery cannot be shown. | Each notification stores the source message id and the time (`backend/services/notification/migrations/0001_init_notification_schema.sql:31`). | Low. | None. |
| Information disclosure | A user reads or marks another user's notification. | Every query filters on the caller's id; another user's id looks like "not found" (`backend/services/notification/src/repo/notifications.ts:54`, `backend/services/notification/src/repo/notifications.ts:80`). | Low. | None. |
| Denial of service | A flood of reads, or a database error, takes the service down. | Page size is capped at 100 (`backend/services/notification/src/api/notifications.ts:36`). | The three routes have no rate limiter, and the async handlers have no error handling (found 2 Nov, fix in flight). | `backend/services/notification/src/api/notifications.ts:33` (G1, G2). |
| Elevation of privilege | A user acts on a notification route as a different role. | The routes act only on the caller's own rows, whatever the role (`backend/services/notification/src/repo/notifications.ts:91`). | Low. | None. |

## Workflow workers (workers)

Planning-core's Temporal worker runs CompleteEvent and HoldExpiry (`backend/services/planning-core/src/temporal/worker.ts:1`); cancellation is one core transaction, not a workflow (ADR-0009). On the VM it is a supervisord program of the same container (`deploy/space/supervisord.conf:58`).

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A rogue worker polls the task queue. | Temporal Cloud connections use TLS and an API key when one is set (`backend/services/planning-core/src/temporal/domain/settings.ts:51`). On the VM the dev server listens on 127.0.0.1 only (`deploy/space/supervisord.conf:30`). | Gap: the VM's Temporal has no authentication, so any process in the container can use it. Without a key the connection is plain. | Fail startup in production without an API key, or accept the single-container boundary and say so. |
| Tampering | A workflow input is altered. | Workflow histories are replay-tested (`tests/EN-11/EN-11-T3-replay-existing-workflow-histories.md:1`). | Low. | None. |
| Repudiation | A timed action (a hold expiry) has no actor. | Activities act through the module's own functions and record `SYSTEM` (`backend/services/planning-core/src/temporal/activities/holdExpiry.ts:4`). | Low. | None. |
| Information disclosure | Payloads in workflow history expose data. | Workflows carry ids, not personal data (`backend/services/planning-core/src/temporal/activities/completion.ts:4`). | Low. | Keep it that way; do not put names in workflow inputs. |
| Denial of service | A stuck activity retries forever; the VM restarts and loses timers. | None: the activities rely on Temporal's default retry policy. The VM's Temporal keeps its state in SQLite under `/tmp/cs`, so a container restart loses running workflows and timers (`deploy/space/supervisord.conf:30`, ADR-0016). | Medium: a hold's expiry timer can be lost on every deploy. | Review activity timeouts; re-derive hold timers from the database at start (follow-up). |
| Elevation of privilege | A worker uses more database privilege than needed. | None: it uses the planning-core `DATABASE_URL`, which owns the tables. | Medium. | Database roles per workload (G5). |

## Policy decision point (cerbos)

Cerbos 0.56 (EN-07, ADR-0010). Planning-core asks it on every route through `requireRole` and `permissionGate` (`backend/services/planning-core/src/shared/authz/gate.ts:54`) and for the navigation check (`backend/services/planning-core/src/modules/identity/api/permissions.ts:69`). Registration and notification do not call it.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A caller impersonates the PDP. | The image listens on all interfaces (`deploy/cerbos/config.yaml:4`); on the VM supervisord overrides that to 127.0.0.1, so only co-located processes reach it (`deploy/space/supervisord.conf:39`). The image pins Cerbos by digest and runs as uid 10001 (`deploy/cerbos/Dockerfile:12`, `deploy/cerbos/Dockerfile:26`). | Gap: the HTTP call carries no credential. Anything that can reach 127.0.0.1:3592 can ask, and in a Kubernetes namespace every pod could. | Add a NetworkPolicy when the manifests are applied. |
| Tampering | A policy file is changed to widen access. | Policies are in git and compiled and tested by role in CI and again when the image is built (`policies/README.md:17`, `deploy/cerbos/Dockerfile:16`, `backend/packages/contracts/tests/policyRoles.test.ts:1`). The image has `watchForChanges: false`, so a running PDP does not reload files (`deploy/cerbos/config.yaml:10`). | Gap: no CODEOWNERS file requires review of `policies/`. | Add CODEOWNERS for `policies/`. |
| Repudiation | A decision cannot be explained. | Gap: Cerbos audit logging is off (`deploy/cerbos/config.yaml:11`), and planning-core logs a refusal but not the rule that decided it. | Medium. | Log each refusal with the principal, kind and action; enable Cerbos decision logs. |
| Information disclosure | Policies reveal the role model. | The policies are plain files in a private repository (`policies/resources/event.yaml:1`); the image carries only policies, not tests (`deploy/cerbos/Dockerfile:22`). | Low. | None. |
| Denial of service | If the PDP is down, nothing is allowed or everything is. | Fail closed: every question has a 2 second timeout and a failure becomes 503 `POLICY_UNAVAILABLE`, never an allow (`backend/services/planning-core/src/shared/authz/pdp.ts:21`). In production the local-policies fallback is refused at startup (`backend/services/planning-core/src/shared/authz/startup.ts:55`). The deploy gate waits for Cerbos to report SERVING (`deploy/azure/connectsphere-vm-deploy:58`). | One PDP per container, restarted by supervisord (`deploy/space/supervisord.conf:38`). | None. |
| Elevation of privilege | The policies say one thing and the code another. | Handlers ask the PDP, so the policy files are the only list of roles for planning-core (`policies/README.md:5`). The local-policies mode evaluates the same files for development (`backend/services/planning-core/src/shared/authz/localPolicies.ts:5`). | Medium: registration and notification keep their own role checks, which nothing compares with `policies/resources/registration.yaml`. | Wire the registration service to the PDP, or add a test that compares them (G5). |

## Core database (coreDb)

Supabase Postgres 15, one schema per module.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone connects with the shared connection string. | The string is read from the environment and never committed (`backend/services/planning-core/src/shared/config.ts:20`, `.env.example:37`). | One credential for all five modules, the outbox relay and the workers. | Role per workload (G5). |
| Tampering | A bug or user writes invalid data. | Invariants are constraints, not code: exclusion constraints, CHECKs, foreign keys (`backend/services/planning-core/migrations/venue/0003_venue_slots_and_unavailability.sql:72`). Queries are parameterised, with no `sql.unsafe` anywhere in the services' source. | Low. | None. |
| Repudiation | Row changes cannot be attributed. | Every table carries `created_by` and `updated_by` (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:10`). | The values come from the application, not the database session. | Acceptable. |
| Information disclosure | A module reads another module's tables. | `npm run lint:boundaries` fails on a cross-schema import or SQL naming (`backend/services/planning-core/package.json:17`). Postgres row-level security on event and assignment rows: scoped reads run as the login-less role `connectsphere_request` with transaction-local claims, and missing claims see nothing (`backend/services/planning-core/migrations/event/0025_row_level_security.sql:81`, `backend/services/planning-core/src/modules/event/repo/requestRole.ts:30`; test `backend/services/planning-core/tests/event/repo/rowLevelSecurity.test.ts`). | Row-level security covers `event.events` and `event.assignments` only; the other schemas have none, and there are no per-module grants, so for them the lint is the only barrier. | Extend RLS to the venue, equipment and change schemas (G5). |
| Denial of service | Connection exhaustion. | Pool of 10 with a connect timeout (`backend/services/planning-core/src/shared/db.ts:9`). | Medium on the shared pooler. | Capacity-test in EN-18. |
| Elevation of privilege | The application role can change schema. | Partly: the services read one `DATABASE_URL` (`backend/services/planning-core/src/shared/config.ts:20`), and the VM keeps a second setting, `MIGRATE_DATABASE_URL` for migrations and `DATABASE_URL` for the services (`deploy/azure/connectsphere-vm-deploy:30`). start.sh falls back to the migration URL when the pooler port is unreachable (`deploy/space/start.sh:58`), and both exist in the process environment. | Medium. | Separate the migration role from the runtime role (G5). |

## Registration database (registrationDb)

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone connects with the registration connection string. | The string is read from the environment (`backend/services/registration/src/config.ts:14`). | One credential for the whole schema and the consumer. | Role per workload (G5). |
| Tampering | Seats are double-claimed or duplicated. | Constraints and the single-statement claim (`backend/services/registration/migrations/0001_init_registration_schema.sql:44`, `backend/services/registration/src/repo/seats.ts:62`). | Low. | None. |
| Repudiation | Claims cannot be attributed. | `claimed_by` and `claimed_at` (`backend/services/registration/migrations/0001_init_registration_schema.sql:45`). | Low. | None. |
| Information disclosure | Attendee data leaks from backups or exports. | Seats hold ids only (`backend/services/registration/migrations/0001_init_registration_schema.sql:25`); R2 will add registrations. | Medium once R2 ships. | Classify registration columns when R2 is designed (see `pdpa.md`). |
| Denial of service | Table bloat from huge seat plans. | None. | See registration-service. | G4. |
| Elevation of privilege | The service writes outside its schema. | None. | Medium. | G5. |

## Notification database (notificationDb)

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone connects with the notification connection string. | The string is read from the environment (`backend/services/notification/src/config.ts:14`). | One credential for the schema, the API and the consumers. | Role per workload (G5). |
| Tampering | A notification is edited after the fact. | Read state is the only update the API performs (`backend/services/notification/src/repo/notifications.ts:80`). | Low. | None. |
| Repudiation | It is unclear why a notification exists. | `source_message_id` ties it to a message (`backend/services/notification/migrations/0001_init_notification_schema.sql:31`). | Low. | None. |
| Information disclosure | Message text names people and events. | Text says "your event request ... has been approved" and may include a coordinator's display name (`backend/services/notification/src/domain/recipients.ts:177`). | Low. | See `pdpa.md` (retention). |
| Denial of service | Unbounded growth. | None: no retention job. | Medium over time. | Add retention (see `pdpa.md`). |
| Elevation of privilege | As the core database. | None. | Medium. | G5. |

## Event log (kafka)

Hosted Kafka (one shared cluster) in development; one Redpanda broker per environment on the VM (ADR-0016). The VM's broker keeps its data on the container's disk, so a redeploy empties the topics.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A client without credentials connects. | TLS is on by default and SASL is required (`backend/packages/kafka/src/config.ts:46`, `backend/packages/kafka/src/config.ts:62`). On the VM the Redpanda broker listens on 127.0.0.1, requires SASL and TLS, and its one user's password is generated at every start (`deploy/space/redpanda.yaml:13`, `deploy/space/redpanda.yaml:17`, `deploy/space/start.sh:33`). | One shared credential set, so any service can impersonate another; the broker's CA is created inside the container and lives as long as it. | Per-service users and ACLs (G7). |
| Tampering | A message is altered or invented. | Every message is schema-validated on consumption (`backend/packages/contracts/src/cloudEvent.ts:101`). | No signature, so a valid-looking forgery is accepted. | G7. |
| Repudiation | A producer denies a message. | Each message has an id, time, trace id and actor (`backend/packages/contracts/src/cloudEvent.ts:69`). | The actor is self-declared. | G7. |
| Information disclosure | Messages carry personal data to every consumer. | Payloads are mostly ids and references (`backend/packages/contracts/src/cloudEvent.ts:85`), but assignment messages carry the coordinator's display name (`backend/packages/contracts/src/eventEvents.ts:47`). | Low today: staff names only. | R2 must not put attendee names or emails in payloads. |
| Denial of service | A poison message blocks a consumer. | Retry topic, a limit of 3 and a dead-letter topic in notification (`backend/services/notification/src/domain/retryPolicy.ts:8`). Registration has neither; it logs and skips (`backend/services/registration/src/consumer/handleApproval.ts:14`). | Medium for registration. | Add retry and DLQ with R2. |
| Elevation of privilege | A consumer reads topics it should not. | None: ACLs are not in the repository. | Medium. | G7. |

## Workflow engine (temporal)

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A client connects to the namespace. | API key and TLS when configured (`backend/services/planning-core/src/temporal/domain/settings.ts:52`). | The key is shared by every worker. | One key per workload. |
| Tampering | Workflow state is changed. | Managed by the provider; replay tests catch code that breaks old histories (`tests/EN-11/EN-11-T3-replay-existing-workflow-histories.md:1`). | Low. | None. |
| Repudiation | A timer fires with no record. | Activities write through module functions that keep history (`backend/services/planning-core/src/temporal/activities/holdExpiry.ts:4`). | Low. | None. |
| Information disclosure | Payload data is readable by the provider. | Workflow inputs are ids (`backend/services/planning-core/src/temporal/activities/completion.ts:4`). | Low. | Keep personal data out of inputs. |
| Denial of service | The provider is unavailable. | The API does not depend on Temporal: outbox rows wait for the relay (`backend/services/planning-core/src/shared/outbox-relay.ts:127`). | Low. | None. |
| Elevation of privilege | A workflow runs activities it should not. | The activity list is fixed in code (`backend/services/planning-core/src/temporal/activities/completion.ts:4`). | Low. | None. |

## Vercel-hosted SPA (staffConsole, attendeeApp)

The static bundle is served by Vercel in staging and production (ADR-0016, `vercel.json`). The staff console and attendee app rows above cover what the code does; these rows cover the hosting.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A hostile origin calls the API with a user's token. | Each service allows only the exact https origins listed in `CORS_ALLOWED_ORIGINS` and refuses a wildcard or path at startup (`backend/services/registration/src/cors.ts:20`, `backend/services/registration/src/cors.ts:37`). The deploy gate requires the setting (`deploy/azure/connectsphere-vm-deploy:31`). | Low. | None. |
| Tampering | The bundle is altered in the build. | `vercel.json` installs with `npm ci --ignore-scripts` (`vercel.json:4`). Vercel's own Git deployments are off (`vercel.json:7`), so a deploy comes only from the release workflow. | The bundle is not signed; Vercel's integrity is trusted. | None. |
| Repudiation | Not applicable: the host serves public files. | n/a | n/a | None. |
| Information disclosure | A secret ships in the bundle, or a script is injected. | Only the Supabase URL and anon key are injected (`frontend/vite.config.ts:25`); `gitleaks` scans commits (`.github/workflows/ci.yml:422`). Headers: `nosniff`, `X-Frame-Options: DENY`, referrer policy, a locked Permissions-Policy (`vercel.json:13`). | The Content-Security-Policy is **report-only** (`vercel.json:18`), so it blocks nothing. It also allows `https://*.sslip.io` and `https://*.duckdns.org`, which anyone can register. The token is still in `sessionStorage` (G9). | Promote the policy to enforcing and narrow `connect-src` to the two API hosts. |
| Denial of service | The CDN is unavailable. | Static assets are cached with `immutable` and the shell is `no-cache` (`vercel.json:25`, `vercel.json:29`). | The API is a separate host and stays up. | None. |
| Elevation of privilege | Client code trusted to enforce roles. | Navigation asks the server (`POST /api/v1/permissions/check`) and every API route enforces the role itself. | Low. | None. |

## Azure VM deployment

One Azure VM runs both environments as containers behind host Caddy; the Release workflow deploys to it over SSH (`.github/workflows/deploy-vm-environment.yml`, ADR-0016 amendment).

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone else deploys, or the runner is fooled about which host it talks to. | Each environment has its own SSH key whose `authorized_keys` line forces one command and sets `restrict`, so there is no shell, forwarding or other environment (`deploy/azure/setup-deploy-user.sh:39`, `deploy/azure/setup-deploy-user.sh:40`). The runner pins the host key with `StrictHostKeyChecking yes` (`.github/workflows/deploy-vm-environment.yml:131`). The staging and production keys must differ (`deploy/azure/setup-deploy-user.sh:22`). | Low. | None. |
| Tampering | A different or unsigned image is deployed. | The gate accepts only `ghcr.io/<owner>/connectsphere-space@sha256:<64 hex>`, a digest, never a tag (`deploy/azure/connectsphere-vm-deploy:65`). Before the SSH step the workflow runs `cosign verify` against the release workflow's identity (`.github/workflows/deploy-vm-environment.yml:110`). The gate accepts only eight named settings and refuses a duplicate or a missing required one (`deploy/azure/connectsphere-vm-deploy:30`, `deploy/azure/connectsphere-vm-deploy:81`). | The VM itself does not verify the signature; it trusts the runner's check and the digest. | Run `cosign verify` inside the gate. |
| Repudiation | A deploy cannot be attributed. | The job runs under a GitHub `environment` (`.github/workflows/deploy-vm-environment.yml:39`), and production is meant to wait for a required reviewer there; that rule is a GitHub setting, not a file in the repository, so it is not verified here. The workflow run records who approved it. | The gate keeps no log of its own on the VM; sshd's auth log is the only record there. | Log each gate call with the image digest. |
| Information disclosure | Secrets are readable on the VM. | The gate writes the env file by copying from a `0700` temporary directory with `umask 007`, then `chmod 660`, replacing the file rather than editing it (`deploy/azure/connectsphere-vm-deploy:88`, `deploy/azure/connectsphere-vm-deploy:89`). The GHCR token is used for the pull in a temporary Docker config and never stored (`deploy/azure/connectsphere-vm-deploy:95`). The gate prints key names, never values. | Gap: the file is group-readable by `connectsphere`, whose members are the admin user and `cs-deploy` (`deploy/azure/setup-deploy-user.sh:27`). Every process in the container inherits every setting, including the service-role key and the migration URL, and `docker inspect` shows them to the docker group. | Keep the group to those two users; split the service-role key out of the planning services' environment. |
| Denial of service | One environment starves the other, or the disk fills. | Redpanda memory is capped per environment with `REDPANDA_MEMORY` (`deploy/azure/connectsphere-vm-deploy:30`); 4 GB swap (`deploy/azure/cloud-init.yaml:12`). Containers restart unless stopped (`deploy/azure/connectsphere-vm-deploy:100`). Only TCP 22, 80 and 443 are allowed in (`deploy/azure/create-vm.sh:79`). | Staging and production share one small VM, and a deploy replaces the container, so the environment is down while it restarts (`deploy/azure/connectsphere-vm-deploy:99`). | Gap: single VM, no failover. |
| Elevation of privilege | The deploy user takes over the host. | The key can run only the gate, and the gate validates its arguments before touching Docker (`deploy/azure/connectsphere-vm-deploy:63`, `deploy/azure/connectsphere-vm-deploy:65`). | Gap: `cs-deploy` is in the `docker` group (`deploy/azure/setup-deploy-user.sh:27`), which is root-equivalent if the forced command is ever bypassed. Port 22 is open to `*` (`deploy/azure/create-vm.sh:83`). The app container runs as uid 1000 (`deploy/space/Dockerfile:57`). | Restrict port 22 to known addresses; consider rootless Docker. |

## Telemetry (OpenTelemetry)

`@connectsphere/telemetry` starts the OpenTelemetry SDK in every service (ADR-0013, EN-08).

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Spans or metrics are sent to the wrong collector. | With no `OTEL_EXPORTER_OTLP_ENDPOINT` nothing is exported and nothing connects anywhere (`backend/packages/telemetry/src/sdk.ts:19`). The endpoint and its headers come only from the standard variables. | No deployment file sets any `OTEL_*` variable, so staging and production export nothing today. | Gap: no collector is configured on the VM; the dashboards and alerts in `deploy/` have no data source there. |
| Tampering | A request forges a trace or correlation id. | The correlation id is the trace id the SDK made, set on the request (`backend/packages/telemetry/src/http.ts:62`). | A client-supplied id is accepted (G12). | One validating middleware. |
| Repudiation | Request flow cannot be reconstructed. | The `traceparent` travels in Kafka headers, so a consumer continues the producer's trace (`backend/packages/telemetry/src/kafka.ts:56`). | Low, once a collector exists. | See above. |
| Information disclosure | A trace carries a token, a value or personal data. | SQL spans record the statement with `$n` for every value, never a parameter, and a failure records the SQLSTATE and class, not the driver's message (`backend/packages/telemetry/src/postgres.ts:11`). Probe paths are not traced (`backend/packages/telemetry/src/sdk.ts:56`). | HTTP spans record the URL path, which includes ids; the query string may carry cursors. | Review the HTTP span attributes before pointing an exporter at a third party. |
| Denial of service | An unreachable collector blocks shutdown. | `shutdown()` gives up after 5 seconds (`backend/packages/telemetry/src/sdk.ts:60`). | Low. | None. |
| Elevation of privilege | Not applicable: the SDK has no inbound port. `/metrics` is covered under the gateway. | n/a | n/a | None. |

## CI and supply chain

The pipeline that builds what the VM runs.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A fake action or image enters the build. | Third-party actions are pinned by commit SHA and a job checks it (`.github/workflows/supply-chain.yml:40`). Images are signed keyless with cosign and verified against the release workflow's identity (`.github/workflows/release.yml:177`). | Low. | None. |
| Tampering | A vulnerable dependency or a poisoned image is shipped. | Trivy scans the filesystem and each image (`.github/workflows/supply-chain.yml:93`); the image gate fails on CRITICAL findings that have a fix (`.github/workflows/supply-chain.yml:375`). A CycloneDX SBOM is made for the workspace and each image and signed (`.github/workflows/supply-chain.yml:61`, `.github/workflows/supply-chain.yml:320`). CodeQL analyses JavaScript and TypeScript (`.github/workflows/codeql.yml:26`). | The gate ignores HIGH findings and anything without a fix. | Gap: no `.github/dependabot.yml` (G14). |
| Repudiation | A change cannot be traced. | Pull-request history, plus the changelog fragment each pull request must carry (`CLAUDE.md`). | Low. | None. |
| Information disclosure | A secret is committed. | `gitleaks` scans the whole history and fails the build (`.github/workflows/ci.yml:422`, `.github/workflows/ci.yml:442`); Trivy's secret scanner runs on the images (`.github/workflows/supply-chain.yml:378`). | Low. | None. |
| Denial of service | CI is blocked or a flaky job hides a real failure. | Not assessed. | n/a | None. |
| Elevation of privilege | CI uses the shared database or gains deploy rights. | CI integration tests run against an ephemeral Postgres on the runner, never the shared database (`CLAUDE.md`); the gateway workflow's token is `contents: read` (`.github/workflows/gateway.yml:30`). The ZAP baseline scans the web app and the planning-core API (`.github/workflows/supply-chain.yml:385`). | The ZAP baseline is passive and non-blocking while findings are triaged (`documentation/evidence/EN-21/zap.md`). | None. |

## Supabase Auth (external)

Not a C4 container, but every trust decision starts here.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Weak or shared passwords. | Password checks are Supabase's. The seed script sets one shared test password (`backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts:23`). | Password policy and MFA settings are not in the repository, so they are unverified. The C4 model says "MFA for staff" (`documentation/c4/connectsphere.dsl:23`) but no code enforces or checks it. | G9: require MFA for staff and check the `aal` claim. Never run the seed against production. |
| Tampering | A token is altered. | Signature verification with JWKS (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:29`). | `iss`/`aud` not checked. | G8. |
| Repudiation | A login cannot be traced. | `identity.login_audit` (`backend/services/planning-core/src/modules/identity/api/auth.ts:72`). | No address. | G13. |
| Information disclosure | Login reveals which emails exist. | The same message for a wrong email and a wrong password (`backend/services/planning-core/src/modules/identity/api/auth.ts:40`, `backend/services/planning-core/src/modules/identity/api/auth.ts:50`). | A deactivated account says so, but only after the right password. | Accepted. |
| Denial of service | Supabase is down. | Callers get a 503 `IDENTITY_UNAVAILABLE` and nothing is changed (`backend/services/planning-core/src/modules/event/auth/actor.ts:34`). | Login itself can hang (G11). | G11. |
| Elevation of privilege | A revoked session still works. | Logout calls Supabase to revoke (`backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:34`). | The access token stays valid until it expires, the result of the revoke call is ignored, and `verifyJwt` does not check the session. | Keep access tokens short in the Supabase settings; check `response.ok` on revoke (G11). |

## Top gaps, ranked

Ranked by risk now and by how cheap the fix is. "Fix in flight" gaps were found on 2 Nov 2026 and another pull request is fixing them; they are gaps until that PR merges. Nothing here is marked Met.

| Rank | Gap | Severity | Location | Suggested fix |
|---|---|---|---|---|
| G1 | No async error handling: a rejected promise in an async handler crashes the process on Node 20. **Fixed 4 Nov:** a router-layer patch passes rejections to the error handler (`backend/services/planning-core/src/shared/asyncErrors.ts:1`) and a process guard logs and exits (`backend/services/planning-core/src/shared/processGuards.ts:14`); notification and registration carry the same. | Critical (closed) | `backend/services/planning-core/src/app.ts:51`, `backend/services/planning-core/src/index.ts:46`, `backend/services/notification/src/api/notifications.ts:33` | An error middleware, a wrapper for async handlers, and an `unhandledRejection` handler that logs and exits cleanly. |
| G2 | Routes without a rate limit. **Closed 4 Nov:** the event routers take `eventRateLimiter()` (`backend/services/planning-core/src/modules/event/api/events.ts:44`) and notification has its own (`backend/services/notification/src/api/notifications.ts:31`). | High (closed) | `backend/services/planning-core/src/modules/event/api/events.ts:46`, `backend/services/planning-core/src/modules/event/api/drafts.ts:20`, `backend/services/notification/src/api/notifications.ts:33` | Pass `eventRateLimiter()` (`backend/services/planning-core/src/modules/event/api/eventRateLimiter.ts:11`) to every event router, and add one to notification. |
| G3 | Stack traces and raw database errors reach clients. (Fix in flight.) | High | `backend/services/planning-core/src/shared/health.ts:30`, `backend/services/notification/src/health.ts:23`, `backend/services/registration/src/health.ts:23` | A final error handler that returns the envelope; fixed text in `/readyz`; `NODE_ENV=production` in every deployment. |
| G4 | Layout capacity is now capped at `MAX_VENUE_CAPACITY` of 1,000,000 (`backend/packages/contracts/src/venueBooking.ts:73`), which still allows a million seat rows from one message; `createSeats` has no cap of its own. | High | `backend/packages/contracts/src/venueBooking.ts:81`, `backend/services/registration/src/repo/seats.ts:34` | `.max()` on `layoutCapacity` (the largest venue plus a margin) and the same cap in `createSeats`. |
| G5 | Authorisation partly in application code. Cerbos is now called by planning-core and row-level security covers event rows, but registration and notification do not call Cerbos, the venue, equipment and change schemas have no RLS, and one database credential serves every module, service and worker. | High | `policies/README.md:5`, `backend/services/planning-core/src/shared/db.ts:9`, `backend/services/registration/src/db.ts:4` | A database role per service with grants on its own schema; wire Cerbos or test that the role checks match the policies. |
| G6 | Venue Staff can edit any venue: `PUT /venues/:id` checks the role, not who staffs the venue. (Fix in flight.) | High | `backend/services/planning-core/src/modules/venue/api/venues.ts:104` | Apply the `STAFF_OWNED_VENUES` scope (`backend/services/planning-core/src/modules/identity/domain/accessScope.ts:27`) to the update. |
| G7 | Kafka messages are trusted: shared credentials, no per-service ACLs, an unsigned `actor`. | Medium | `backend/packages/kafka/src/config.ts:62`, `backend/packages/contracts/src/cloudEvent.ts:84` | One Kafka user per service with topic ACLs; sign or authenticate producers. |
| G8 | The JWT's `iss`, `aud` and algorithm are not checked. | Medium | `backend/services/planning-core/src/shared/auth/verifyJwt.ts:29` | Pass `issuer`, `audience` and `algorithms` to `jwtVerify`; add a test with a token from the wrong audience. |
| G9 | `helmet` is on all three services (`backend/services/planning-core/src/app.ts:33`) and Vercel sends security headers, but the CSP is report-only (`vercel.json:18`), the token is in `sessionStorage`, and staff MFA is claimed in the C4 model but not enforced or checked. | Medium | `vercel.json:18`, `frontend/src/api/session.ts:69` | `helmet` on the services and a CSP on the static host; require MFA for staff in Supabase and check `aal2` for staff roles. |
| G10 | Notification calls planning-core over plain `http://` by default, with the user's token. | Medium (once deployed) | `backend/services/notification/src/config.ts:18` | Refuse a non-HTTPS `PLANNING_CORE_URL` when `NODE_ENV=production`. |
| G11 | Supabase calls have no timeout; logout ignores the result of the revoke call. | Medium | `backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:15`, `backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:34` | `AbortSignal.timeout` on both calls; return 502 when revoke fails. |
| G12 | Registration and notification have no correlation id; planning-core accepts a client-supplied one without limits. | Low | `backend/services/registration/src/app.ts:23`, `backend/services/planning-core/src/app.ts:31` | One shared middleware that validates the format and length. |
| G13 | The login audit has no address, and nothing alerts on repeated failures. | Low | `backend/services/planning-core/src/modules/identity/repo/loginAudit.ts:9` | Add address and user agent; alert on N failures per account. |
| G14 | Dependencies: `npm audit --omit=dev` reports 3 high (body-parser below 1.20.9 and zod below 4.6.6 among them); there is no Dependabot configuration. (The body-parser bump is in flight.) | High | `backend/services/planning-core/package.json:27` | Bump body-parser and zod; add `.github/dependabot.yml`. |
| G15 | Row-level privacy and the PDPA obligations: no consent record, notice, retention job, erasure route, breach procedure or DPO named. | High (legal) | `backend/services/planning-core/src/modules/identity/repo/loginAudit.ts:9`, `backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:32` | See `pdpa.md`. |

The `/metrics` endpoint added by EN-17 is rate-limited before its token check and off in production unless `METRICS_TOKEN` is set (`backend/packages/observability/src/metrics.ts:91`).
