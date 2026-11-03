# OWASP ASVS 4.0.3 Level 2 checklist (EN-23)

**Author:** Joash · **Date:** 2026-11-02 · **Jira:** EN-23 · **Companion documents:** [`threat-model.md`](threat-model.md), [`pdpa.md`](pdpa.md)

This is a checklist of the ASVS 4.0.3 Level 2 requirements that matter to this application, grouped by chapter V1 to V14. It is a selection, not all 286 requirements: it keeps the ones a web API and single-page app with a hosted identity provider can fail, and lists the chapters' non-applicable areas in one row each. Requirement wording is shortened. Check the ASVS text before quoting a requirement.

**Statuses.**

- **Met**: a control exists in the code and is cited as `file:line`. A script test fails if a Met row has no citation or the cited line is past the end of its file.
- **Partly**: some of it exists, or it exists by design but not in code, or it depends on a setting that is not in the repository. The gap column says what is missing.
- **Not met**: nothing exists, or the code does the opposite.
- **N/A**: the requirement does not apply. The reason is given.

Gaps are numbered G1 to G15 as in `threat-model.md`. "Fix in flight" means another pull request is fixing the gap; the status stays as found on 2 Nov 2026 until it merges. Supabase Auth settings are not in the repository, so requirements that depend on them are at best Partly.

## V1 Architecture, design and threat modelling

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 1.1.2 | Threat modelling for every design change | Partly | `documentation/security/threat-model.md:1` | One review at the end of Sprint 4; not yet part of the definition of ready. |
| 1.4.1 | Access control enforced at a trusted point, not the client | Met | `backend/services/planning-core/src/modules/event/auth/actor.ts:64` | None. |
| 1.7.1 | A common logging format | Met | `backend/services/planning-core/src/shared/logger.ts:22` | Registration and notification have their own copy of the logger. |
| 1.8.1 | Sensitive data is identified and classified | Partly | `documentation/security/pdpa.md:1` | Classification is a table in the PDPA note, not enforced by a schema tag. |
| 1.9.1 | Communications between components are encrypted | Partly | Kafka uses TLS and SASL (`backend/packages/kafka/src/config.ts:46`). | Notification to planning-core defaults to `http://` (`backend/services/notification/src/config.ts:18`, G10). |
| 1.10.1 | Source control with change tickets | Partly | Pull requests with CI (`.github/workflows/ci.yml:44`). | Commits are not signed; branch protection is not in the repository. |
| 1.14.1 | Components of different trust levels are segregated | Partly | Services talk only through Kafka or HTTP (`documentation/planning/implementation.md:732`). | One database credential for every component (G5). |

## V2 Authentication

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 2.1.1 | Passwords are at least 12 characters | Partly | Delegated to Supabase Auth; the login route requires only a non-empty password (`backend/services/planning-core/src/modules/identity/api/auth.ts:13`). | The Supabase password setting is not in the repository: verify it. |
| 2.1.7 | New passwords are checked against breached lists | Partly | Delegated to Supabase Auth. | Verify the setting (leaked-password protection). |
| 2.2.1 | Anti-automation on sign-in | Partly | A 30 per minute per-address limit before any Supabase call (`backend/services/planning-core/src/modules/identity/api/limiter.ts:36`). | Per address only; no lockout or alert (G13). |
| 2.2.3 | Users are told of authentication changes | Not met | None. | Supabase can send these emails; enable and verify. |
| 2.4.1 | Passwords are stored with an approved hash | N/A | ConnectSphere never stores passwords; Supabase does. | None. |
| 2.7.1 | Multi-factor or out-of-band verifier is available | Not met | None in code, although the C4 model says "MFA for staff" (`documentation/c4/connectsphere.dsl:23`). | G9. |
| 2.10.4 | No secrets in source | Partly | Secrets come from the environment (`.env.example:37`), `.env` is ignored (`.gitignore:180`) and every commit is scanned (`.github/workflows/ci.yml:213`). | The seed script hard-codes a shared test password (`backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts:23`); it must never run against production. |

## V3 Session management

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 3.1.1 | Session tokens are never in URLs | Met | The token goes in the `Authorization` header (`frontend/src/api/client.ts:49`). | None. |
| 3.3.1 | Logout invalidates the session | Partly | The logout route calls Supabase to revoke (`backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:34`). | The result is ignored, the access token stays valid until it expires, and `verifyJwt` does not check the session (G11). |
| 3.3.2 | Re-authentication after a time limit | Not met | None in code. | Depends on Supabase's session settings: verify. |
| 3.5.2 | Session tokens, not static API secrets | Met | Every call carries a short-lived signed token (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:17`). | None. |
| 3.5.3 | Stateless tokens are signed and verified | Partly | The signature is verified against the project's JWKS (`backend/services/planning-core/src/shared/auth/verifyJwt.ts:29`). | `iss`, `aud` and `alg` are not pinned (G8). |
| 3.7.1 | Re-authentication before sensitive transactions | Not met | None: approving an event or releasing a booking needs only the session. | Decide which actions (deactivating a user, cancelling an event) need step-up. |
| 3.4.1 | Cookie attributes (Secure, HttpOnly, SameSite) | N/A | No cookies are used. | The token is in `sessionStorage` instead (V8.2.2). |

## V4 Access control

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 4.1.1 | Access control is enforced on the server | Met | `requireRole` on every protected route (`backend/services/planning-core/src/modules/event/auth/actor.ts:64`). | None. |
| 4.1.2 | Users cannot change the attributes that drive access | Met | The role and scope come from the identity module, not the request (`backend/services/planning-core/src/modules/event/auth/actor.ts:28`). | None. |
| 4.1.3 | Least privilege | Partly | Per-route role lists, and scoped reads (`backend/services/planning-core/src/modules/event/repo/events.ts:129`). | `PUT /venues/:id` checks only the role (`backend/services/planning-core/src/modules/venue/api/venues.ts:104`, G6, fix in flight); no row-level security (G5). |
| 4.1.5 | Access control fails securely | Met | If identity cannot be reached the request is refused with a 503 and nothing changes (`backend/services/planning-core/src/modules/event/auth/actor.ts:34`). | None. |
| 4.2.1 | Object-level access (no insecure direct object references) | Partly | An event outside the caller's scope reads as "not found" (`backend/services/planning-core/src/modules/event/repo/events.ts:146`); notifications are own-only (`backend/services/notification/src/repo/notifications.ts:80`). | Same venue gap as 4.1.3. |
| 4.2.2 | CSRF defence on state-changing requests | N/A | Authentication is by bearer header, not cookie, so a cross-site request carries no credential. | Re-assess if cookies are ever used. |
| 4.3.1 | Administrative interfaces need MFA | Not met | None. | G9. |

## V5 Validation, sanitisation and encoding

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 5.1.1 | Protection against HTTP parameter pollution | Partly | Query parameters are read as strings and parsed (`backend/services/planning-core/src/modules/identity/api/users.ts:48`). | An array-valued parameter is treated as empty, not rejected. |
| 5.1.3 | Positive validation of all input | Met | zod schemas at the boundary (`backend/services/planning-core/src/modules/identity/api/users.ts:18`). | None. |
| 5.1.4 | Structured data is strongly typed | Met | The same schemas, and CloudEvent validation for messages (`backend/packages/contracts/src/cloudEvent.ts:101`). | The seat capacity has no upper bound (G4). |
| 5.2.1 | HTML input is sanitised | Partly | React escapes text by default. | No sanitiser exists, and none is needed unless `dangerouslySetInnerHTML` is introduced (a search of `frontend/src` finds none today). |
| 5.3.3 | Context-aware output encoding | Partly | As 5.2.1. | No CSP as a second layer (G9). |
| 5.3.4 | Database queries are parameterised | Met | Tagged-template queries throughout (`backend/services/registration/src/repo/seats.ts:31`); there is no `sql.unsafe` in the services. | None. |
| 5.3.8 | No OS command injection | N/A | No code starts a process. | None. |

## V6 Stored cryptography

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 6.1.1 | Regulated personal data is encrypted at rest | Partly | Supabase's disk encryption (the provider's default). | Not verified in the repository; no column-level encryption. |
| 6.2.1 | Cryptographic modules fail securely | N/A | The services implement no cryptography; ids use `randomUUID` (`backend/services/planning-core/src/modules/event/events/outbox.ts:39`). | None. |
| 6.4.1 | Secrets are managed in a secret store | Partly | Environment variables only (`.env.example:37`). | No vault or rotation; the container work (EN-10) is meant to provide one. |

## V7 Error handling and logging

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 7.1.1 | Credentials and tokens are not logged | Partly | The login route logs ids and codes, never the password or token (`backend/services/planning-core/src/modules/identity/api/auth.ts:74`). | By convention only: the logger accepts any field (`backend/services/planning-core/src/shared/logger.ts:13`). Add redaction. |
| 7.2.1 | Authentication decisions are logged | Met | Every sign-in outcome is written to `login_audit` (`backend/services/planning-core/src/modules/identity/api/auth.ts:72`). | No source address (G13). |
| 7.2.2 | Access-control decisions are logged | Met | Every refusal is logged with its code (`backend/services/notification/src/api/errors.ts:8`, `backend/services/planning-core/src/modules/event/api/errors.ts:12`). | None. |
| 7.3.1 | Log injection is prevented | Met | Logs are `JSON.stringify`-ed (`backend/services/planning-core/src/shared/logger.ts:22`). | A client-supplied correlation id is logged unbounded (G12). |
| 7.3.3 | Logs are protected from unauthorised access and change | Not met | Logs go to standard output only. | Ship to a log store with access control (EN-08). |
| 7.4.1 | A generic message is shown for unexpected errors | Not met | Express's default handler is used, which returns a stack trace when `NODE_ENV` is not production (`backend/services/planning-core/src/app.ts:51`). | G3, fix in flight. |
| 7.4.2 | A last-resort error handler exists | Not met | There is no error middleware and no `unhandledRejection` handler (`backend/services/planning-core/src/index.ts:46`). | G1, fix in flight. |

## V8 Data protection

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 8.2.1 | Anti-caching headers on sensitive responses | Not met | None. | Add `Cache-Control: no-store` on authenticated API responses. |
| 8.2.2 | No sensitive data in browser storage | Partly | The token is in `sessionStorage`, not `localStorage` (`frontend/src/api/session.ts:69`). | Still readable by script (G9). |
| 8.3.1 | Sensitive data is sent in the body, not the URL | Met | The login body carries the password (`backend/services/planning-core/src/modules/identity/api/auth.ts:34`). | None. |
| 8.3.2 | Users can remove or export their data | Not met | None. | `pdpa.md`, access and correction. |
| 8.3.4 | Sensitive data is identified and controls defined | Partly | `documentation/security/pdpa.md:1` | No retention job. |

## V9 Communication

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 9.1.1 | TLS for all client connectivity | Partly | By design, at the gateway (EN-12). | Not built; no TLS configuration in the repository. |
| 9.2.1 | Connections to and from the server use trusted TLS | Partly | Kafka: TLS on by default (`backend/packages/kafka/src/config.ts:46`). | Notification to planning-core defaults to plain HTTP (G10). The database URL does not require TLS. |
| 9.2.2 | Encrypted communications between components | Partly | As 9.2.1. | G10. |

## V10 Malicious code

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 10.2.1 | No unauthorised phone-home or data collection | Partly | The only outbound calls are to Supabase, Kafka, Temporal and planning-core (`backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:15`). | No dependency review beyond CI scans. |
| 10.3.2 | Dependencies are integrity-protected | Partly | A lockfile is committed and CI installs with `npm ci` (`.github/workflows/ci.yml:44`). | No signature or provenance check. |
| 10.2.3 | Static analysis in CI | Met | CodeQL runs on every pull request (`.github/workflows/codeql.yml:39`). | None. |

## V11 Business logic

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 11.1.1 | Steps are processed in order | Met | One guarded status machine (`backend/services/planning-core/src/modules/event/domain/statusMachine.ts:96`). | None. |
| 11.1.2 | Human-realistic timing | Partly | Per-route rate limits (`backend/services/planning-core/src/modules/event/api/eventRateLimiter.ts:11`). | 20 routes have none (G2, fix in flight). |
| 11.1.4 | Anti-automation on business functions | Partly | As 11.1.2. | Registration (R2) has no route yet. |
| 11.1.5 | Business limits are enforced | Met | Exclusion constraints stop double booking (`backend/services/planning-core/migrations/venue/0005_booking_requests.sql:53`, `backend/services/planning-core/migrations/equipment/0001_equipment_inventory.sql:75`). | None. |
| 11.1.6 | No time-of-check to time-of-use races | Met | The seat claim is one statement with `FOR UPDATE SKIP LOCKED` (`backend/services/registration/src/repo/seats.ts:62`); a duplicate message hits a primary key (`backend/services/registration/src/consumer/handleApproval.ts:44`). | None. |

## V12 Files and resources

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 12.1.1 | File upload size limits | N/A | The application accepts no uploads. | Re-assess if one is added. |
| 12.3.1 | File names are not used as paths | N/A | No code reads a path from a request. | None. |
| 12.5.1 | Only expected file types are served | N/A | The API serves JSON only. | Static files are served by the host, not the API. |
| 12.6.1 | Server-side requests are limited (SSRF) | Partly | The only server-side call from a request is to a fixed `PLANNING_CORE_URL` (`backend/services/notification/src/api/identity.ts:41`). | The URL comes from configuration, not from users. |

## V13 API and web services

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 13.1.1 | The API is documented and uses the same encoding rules | Met | OpenAPI files, with a test that every route is documented (`backend/services/planning-core/tests/api/openapiRoutes.unit.test.ts:1`). | None. |
| 13.1.3 | URLs do not expose sensitive information | Met | Routes carry ids and references only (`backend/services/planning-core/src/modules/identity/api/auth.ts:23`). | None. |
| 13.1.4 | Authorisation at URL and resource level | Partly | Role per route and scope per resource (`backend/services/planning-core/src/modules/event/auth/actor.ts:64`). | The venue edit (G6). |
| 13.2.1 | Only expected HTTP methods are enabled | Met | Routes are declared per method (`backend/services/planning-core/src/modules/identity/api/auth.ts:23`). | None. |
| 13.2.2 | JSON schema validation of input | Met | zod (`backend/services/planning-core/src/modules/identity/api/users.ts:18`). | None. |
| 13.2.3 | Cross-site request forgery is prevented for RESTful services | Met | Bearer-header authentication (`frontend/src/api/client.ts:49`). | None. |
| 13.4.1 | GraphQL query limits | N/A | No GraphQL. | None. |

## V14 Configuration

| ID | Requirement | Status | Control and evidence | Gap |
|---|---|---|---|---|
| 14.1.1 | The build and deployment are repeatable and secure | Partly | CI builds from the lockfile (`.github/workflows/ci.yml:44`). | Deployment is EN-10, not yet built. |
| 14.2.1 | Components are up to date, with no known vulnerabilities | Not met | `npm audit --omit=dev` reports 3 high vulnerabilities (body-parser, zod and source-map-js) on 2 Nov 2026 (G14). | Bump them; the body-parser bump is in flight. Add Dependabot. |
| 14.2.2 | Unneeded features and sample content are removed | Partly | The API console is open to every role (`frontend/src/App.tsx:193`). | Hide it in production builds. |
| 14.3.2 | Debug modes are off in production | Partly | `NODE_ENV` is set per environment (`.env.example:2`). | Express behaves differently if it is not `production` (G3). |
| 14.3.3 | HTTP headers do not expose version details | Not met | `x-powered-by` is not disabled (`backend/services/planning-core/src/app.ts:20`). | `app.disable("x-powered-by")` or helmet (G9). |
| 14.4.1 | Responses carry a Content-Type with a charset | Met | Express's `res.json` sets `application/json; charset=utf-8` (`backend/services/planning-core/src/modules/event/api/errors.ts:12`). | None. |
| 14.4.3 | A Content-Security-Policy is set | Not met | None (`frontend/index.html:1`). | G9. |
| 14.4.4 | `X-Content-Type-Options: nosniff` | Not met | None. | G9. |
| 14.4.5 | `Strict-Transport-Security` | Not met | None; belongs at the gateway or host. | G9. |
| 14.4.6 | A Referrer-Policy | Not met | None. | G9. |
| 14.5.1 | Only expected HTTP methods are accepted | Met | Routes are declared per method (`backend/services/planning-core/src/modules/identity/api/auth.ts:82`). | None. |
| 14.5.3 | A strict CORS policy | Partly | The browser talks to a same-origin proxy, so no CORS middleware is needed (`frontend/vite.config.ts:9`). | That is the development proxy; the production arrangement (EN-12) must be the same or set CORS explicitly. |

## Tally

Counted from the tables above, by the script that checks this file: see `documentation/scripts/check-docs.test.ts`, which prints the counts.
