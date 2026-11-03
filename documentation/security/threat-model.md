# ConnectSphere threat model (EN-23)

**Author:** Joash · **Date:** 2026-11-02 · **Jira:** EN-23 · **Companion documents:** [`pdpa.md`](pdpa.md), [`asvs-l2.md`](asvs-l2.md)

## How to read this

This is a STRIDE table for each container in the C4 model (`documentation/c4/connectsphere.dsl`). Every row names a threat, the control that **exists in the code today** with a `file:line` reference, the residual risk, and a gap or follow-up. A row whose control is `None` says so plainly, and its last column says what to do.

- Containers tagged "Planned" in the C4 model are not built. Their rows say `None (not built)` and give the design intent, so a reviewer can see which control is promised but absent.
- Line numbers are those of the commit this document was written against. A script test (`documentation/scripts/check-docs.test.ts`) fails when a cited line is past the end of its file. It cannot tell you that the line still says what this document says, so re-check a citation before you rely on it.
- "Fix in flight" means the gap was found on 2 Nov 2026 and another pull request is fixing it. It is recorded as a gap, not as a control.

**Scope and assumptions.** Staff-facing code is `planning-core`; attendee-facing code is the registration and notification services. Supabase Auth is an external system that the team configures but whose settings are not in the repository, so anything that depends on those settings (password rules, MFA, token lifetime) is marked as unverified, not as met. No Kubernetes, gateway or cloud deployment exists yet (ADR-0012), so deployment-level controls such as TLS termination, network policy and secret storage are design intent only.

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

Planned (EN-13 shell, R1 to R7). The registration screens are not built.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A bot registers under many fake accounts. | None (not built). Sign-in is Supabase Auth. | High at launch for a popular event. | Decide sign-up rules (email verification, CAPTCHA or invitation) before R2 ships. |
| Tampering | An attendee changes the event or pool in the request. | None (not built). The seat claim is one SQL statement keyed by event and pool (`backend/services/registration/src/repo/seats.ts:62`). | Medium until R2 validates the body. | R2 must validate the pool and event against the caller's scope. |
| Repudiation | An attendee denies registering. | None (not built). The seat records who and when (`backend/services/registration/migrations/0001_init_registration_schema.sql:45`). | Low. | Keep registrations, never delete (R4 says so). |
| Information disclosure | An attendee sees another attendee's registration. | None (not built). R3 requires own-only access. | Medium. | Write the own-only guard in R3 and test it by direct reference. |
| Denial of service | A flood of registrations at opening time. | None (not built). The claim uses `FOR UPDATE SKIP LOCKED` so racing claims do not queue (`backend/services/registration/src/repo/seats.ts:57`). | Medium. | Rate-limit R2 before authentication; the load test is EN-18. |
| Elevation of privilege | An attendee calls staff routes. | Staff routes refuse the `ATTENDEE` role (`backend/services/planning-core/src/modules/identity/api/users.ts:37`, `backend/services/planning-core/src/modules/event/auth/actor.ts:64`). | Low. | None. |

## API gateway (gateway)

Planned (EN-12). Today the Vite dev proxy stands in, and no gateway exists in any deployment.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A service trusts that a request came through the gateway. | Every service verifies the token itself (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:11`). | Low. | None. |
| Tampering | Headers such as `x-forwarded-for` choose the rate-limit key. | Express keeps `trust proxy` off, so forwarded headers do not choose the key (`backend/services/planning-core/src/modules/equipment/api/limiter.ts:8`). | Behind a real proxy every client then shares one address. | Set `trust proxy` correctly when the gateway exists (EN-12). |
| Repudiation | Requests cannot be traced to a caller. | planning-core logs a correlation id on each request (`backend/services/planning-core/src/app.ts:31`). Registration and notification do not. | Medium. | Add the correlation middleware to both (G12). |
| Information disclosure | `/metrics` or health routes are exposed to the internet. | `/metrics` is off in production without `METRICS_TOKEN` (`backend/packages/observability/src/metrics.ts:92`). Health routes answer without a token. | Medium. | Do not route `/metrics`, `/healthz` or `/readyz` through the gateway. |
| Denial of service | Request floods. | None (not built). Each module carries a temporary per-IP limiter (`backend/services/planning-core/src/modules/identity/api/limiter.ts:36`). | High: 20 routes have no limiter at all (G2). | EN-12 must rate-limit per user; until then fix G2. |
| Elevation of privilege | The gateway routes an internal path to the public. | None (not built). | Unknown. | Allow-list public paths in the gateway config and test it. |

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

Planned in the C4 model; the Temporal worker code for CompleteEvent and HoldExpiry exists (`backend/services/planning-core/src/temporal/worker.ts:1`), the other workflows do not.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A rogue worker polls the task queue. | Temporal Cloud connections use TLS and an API key when one is set (`backend/services/planning-core/src/temporal/domain/settings.ts:52`). | Without a key the connection is plain (local development only). | Fail startup in production without an API key. |
| Tampering | A workflow input is altered. | Workflow histories are replay-tested (`tests/EN-11/EN-11-T3-replay-existing-workflow-histories.md:1`). | Low. | None. |
| Repudiation | A timed action (a hold expiry) has no actor. | Activities act through the module's own functions and record `SYSTEM` (`backend/services/planning-core/src/temporal/activities/holdExpiry.ts:4`). | Low. | None. |
| Information disclosure | Payloads in workflow history expose data. | Workflows carry ids, not personal data (`backend/services/planning-core/src/temporal/activities/completion.ts:4`). | Low. | Keep it that way; do not put names in workflow inputs. |
| Denial of service | A stuck activity retries forever. | None in this repository: the activities rely on Temporal's default retry policy. | Medium: not reviewed here. | Review activity timeouts (follow-up). |
| Elevation of privilege | A worker uses more database privilege than needed. | None: it uses the planning-core `DATABASE_URL`. | Medium. | Database roles per workload (G5). |

## Policy decision point (cerbos)

Planned (EN-07). The policies exist; nothing calls them.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A caller impersonates the PDP. | None (not built). | n/a | Call it over mTLS or on localhost. |
| Tampering | A policy file is changed to widen access. | Policies are in git and tested by role against every action in CI (`policies/README.md:17`, `backend/packages/contracts/tests/policyRoles.test.ts:1`). | Low. | Require review on `policies/` (CODEOWNERS). |
| Repudiation | A decision cannot be explained. | None (not built). | n/a | Log each decision with the principal and the rule. |
| Information disclosure | Policies reveal the role model. | The policies are plain files in a private repository (`policies/resources/event.yaml:1`). | Low. | None. |
| Denial of service | If the PDP is down, nothing is allowed or everything is. | None (not built). | n/a | Decide fail-closed and test it when wiring. |
| Elevation of privilege | The policies say one thing and the code another. | The README warns that handlers use `requireRole` until Cerbos is wired and to keep the two in step (`policies/README.md:5`). | Medium: nothing proves they agree. | Wire Cerbos, or add a test that compares them (G5). |

## Core database (coreDb)

Supabase Postgres 15, one schema per module.

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | Someone connects with the shared connection string. | The string is read from the environment and never committed (`backend/services/planning-core/src/shared/config.ts:20`, `.env.example:37`). | One credential for all five modules, the outbox relay and the workers. | Role per workload (G5). |
| Tampering | A bug or user writes invalid data. | Invariants are constraints, not code: exclusion constraints, CHECKs, foreign keys (`backend/services/planning-core/migrations/venue/0003_venue_slots_and_unavailability.sql:72`). Queries are parameterised, with no `sql.unsafe` anywhere in the services' source. | Low. | None. |
| Repudiation | Row changes cannot be attributed. | Every table carries `created_by` and `updated_by` (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:10`). | The values come from the application, not the database session. | Acceptable. |
| Information disclosure | A module reads another module's tables. | `npm run lint:boundaries` fails on a cross-schema import or SQL naming (`backend/services/planning-core/package.json:17`). | No row-level security and no per-module grants, so the lint is the only barrier. | No `create policy` exists in any migration (G5). |
| Denial of service | Connection exhaustion. | Pool of 10 with a connect timeout (`backend/services/planning-core/src/shared/db.ts:9`). | Medium on the shared pooler. | Capacity-test in EN-18. |
| Elevation of privilege | The application role can change schema. | None: the same credential runs migrations and the API. | Medium. | Separate the migration role from the runtime role (G5). |

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

Hosted Kafka (one shared cluster).

| STRIDE | Threat | Control in code | Residual risk | Gap or follow-up |
|---|---|---|---|---|
| Spoofing | A client without credentials connects. | TLS is on by default and SASL is required (`backend/packages/kafka/src/config.ts:46`, `backend/packages/kafka/src/config.ts:62`). | One shared credential set, so any service can impersonate another. | Per-service users and ACLs (G7). |
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
| G1 | No async error handling: a rejected promise in an async handler crashes the process on Node 20. (Fix in flight.) | Critical | `backend/services/planning-core/src/app.ts:51`, `backend/services/planning-core/src/index.ts:46`, `backend/services/notification/src/api/notifications.ts:33` | An error middleware, a wrapper for async handlers, and an `unhandledRejection` handler that logs and exits cleanly. |
| G2 | 20 routes have no rate limit: 17 in the event module and the 3 notification routes. (Fix in flight.) | High | `backend/services/planning-core/src/modules/event/api/events.ts:46`, `backend/services/planning-core/src/modules/event/api/drafts.ts:20`, `backend/services/notification/src/api/notifications.ts:33` | Pass `eventRateLimiter()` (`backend/services/planning-core/src/modules/event/api/eventRateLimiter.ts:11`) to every event router, and add one to notification. |
| G3 | Stack traces and raw database errors reach clients. (Fix in flight.) | High | `backend/services/planning-core/src/shared/health.ts:30`, `backend/services/notification/src/health.ts:23`, `backend/services/registration/src/health.ts:23` | A final error handler that returns the envelope; fixed text in `/readyz`; `NODE_ENV=production` in every deployment. |
| G4 | Unbounded layout capacity lets one message insert millions of seat rows. | High | `backend/packages/contracts/src/venueBooking.ts:81`, `backend/services/registration/src/repo/seats.ts:34` | `.max()` on `layoutCapacity` (the largest venue plus a margin) and the same cap in `createSeats`. |
| G5 | Authorisation only in application code: no row-level security, Cerbos never called, one database credential for every module, service and worker. | High | `policies/README.md:5`, `backend/services/planning-core/src/shared/db.ts:9`, `backend/services/registration/src/db.ts:4` | A database role per service with grants on its own schema; wire Cerbos or test that the role checks match the policies. |
| G6 | Venue Staff can edit any venue: `PUT /venues/:id` checks the role, not who staffs the venue. (Fix in flight.) | High | `backend/services/planning-core/src/modules/venue/api/venues.ts:104` | Apply the `STAFF_OWNED_VENUES` scope (`backend/services/planning-core/src/modules/identity/domain/accessScope.ts:27`) to the update. |
| G7 | Kafka messages are trusted: shared credentials, no per-service ACLs, an unsigned `actor`. | Medium | `backend/packages/kafka/src/config.ts:62`, `backend/packages/contracts/src/cloudEvent.ts:84` | One Kafka user per service with topic ACLs; sign or authenticate producers. |
| G8 | The JWT's `iss`, `aud` and algorithm are not checked. | Medium | `backend/services/planning-core/src/shared/auth/verifyJwt.ts:29` | Pass `issuer`, `audience` and `algorithms` to `jwtVerify`; add a test with a token from the wrong audience. |
| G9 | No security headers or CSP, `x-powered-by` is on, the token is in `sessionStorage`, and staff MFA is claimed in the C4 model but not enforced or checked. | Medium | `backend/services/planning-core/src/app.ts:20`, `frontend/index.html:1`, `frontend/src/api/session.ts:69` | `helmet` on the services and a CSP on the static host; require MFA for staff in Supabase and check `aal2` for staff roles. |
| G10 | Notification calls planning-core over plain `http://` by default, with the user's token. | Medium (once deployed) | `backend/services/notification/src/config.ts:18` | Refuse a non-HTTPS `PLANNING_CORE_URL` when `NODE_ENV=production`. |
| G11 | Supabase calls have no timeout; logout ignores the result of the revoke call. | Medium | `backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:15`, `backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:34` | `AbortSignal.timeout` on both calls; return 502 when revoke fails. |
| G12 | Registration and notification have no correlation id; planning-core accepts a client-supplied one without limits. | Low | `backend/services/registration/src/app.ts:23`, `backend/services/planning-core/src/app.ts:31` | One shared middleware that validates the format and length. |
| G13 | The login audit has no address, and nothing alerts on repeated failures. | Low | `backend/services/planning-core/src/modules/identity/repo/loginAudit.ts:9` | Add address and user agent; alert on N failures per account. |
| G14 | Dependencies: `npm audit --omit=dev` reports 3 high (body-parser below 1.20.9 and zod below 4.6.6 among them); there is no Dependabot configuration. (The body-parser bump is in flight.) | High | `backend/services/planning-core/package.json:27` | Bump body-parser and zod; add `.github/dependabot.yml`. |
| G15 | Row-level privacy and the PDPA obligations: no consent record, notice, retention job, erasure route, breach procedure or DPO named. | High (legal) | `backend/services/planning-core/src/modules/identity/repo/loginAudit.ts:9`, `backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:32` | See `pdpa.md`. |

The `/metrics` endpoint added by EN-17 is rate-limited before its token check and off in production unless `METRICS_TOKEN` is set (`backend/packages/observability/src/metrics.ts:91`).
