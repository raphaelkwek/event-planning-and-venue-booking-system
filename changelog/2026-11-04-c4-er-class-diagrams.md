# Architecture diagrams: C4 brought up to date, generated ER diagrams, domain and state diagrams

**Timestamp:** 2026-11-04T09:05+08:00 (SGT)
**Author:** Joash
**Scope:** `documentation/security/threat-model.md`; `documentation/c4/connectsphere.dsl` and its README; new `documentation/architecture.md` and
`documentation/architecture/`; `documentation/scripts/generate-er-diagrams.ts` and
`generate-state-machines.ts` with their tests; `.github/workflows/diagrams.yml`; two npm script pairs.
No code under `backend/` or `frontend/` and no migration.

The compliance audit found the C4 model stale since 2 Oct (19 built elements still tagged "Planned", an AWS
deployment drawn while staging runs on an Azure VM) and no class or data-model diagram (fix-list item 11).

## Changed

- **C4 model.** "Planned" now marks only what is not built: the email provider and the AWS scale-up. Built
  and drawn as such: the registration and notification services, the Temporal workers, Cerbos, the three
  databases, Kafka (Redpanda in staging and production), Temporal, the attendee surface (routes of the same
  SPA; the installable PWA of ADR-0014 is not built), and Grafana Cloud as an opt-in OTLP target.
  Kong is tagged `CiOnly`: built and exercised in `gateway.yml`, deployed nowhere.
- **Corrections to what the old model claimed.** Cancellation is one core transaction, not a Temporal
  workflow (ADR-0009's implementation note); the workers run only CompleteEvent and HoldExpiry, from Kafka,
  against the core database; registration and notification call planning-core's identity module over HTTP and
  never Cerbos; the front ends call the services directly, not through Kong.
- **Deployment views.** Development, Staging and Production (Vercel SPA, one Azure VM running a container
  per environment with Redpanda, the Temporal dev server and Cerbos, one Supabase project per environment;
  ADR-0016 and its Azure amendment), ContinuousIntegration, and AwsScaleUp (dashed).

## Added

- **ER diagrams**, one per schema (identity, event, venue, equipment, change, registration, notification) in
  `documentation/architecture/data-model/`, generated from the migrations by `npm run diagrams:er`. The
  script replays the migrations statically, so it needs no database. `npm run diagrams:er:check` and a unit
  test fail when a committed diagram is stale.
- **Domain model** (class diagram) and state diagrams for booking, hold and registration, by hand, and the
  **event status machine**, generated from `statusMachine.ts` by `npm run diagrams:states`.
- **`documentation/architecture.md`**, the index that links all of them, and the commands to refresh them.
- **Diagrams workflow:** a second job runs both checks and renders the new diagrams to SVG and PNG with the
  same PlantUML image as the C4 views; it runs when a migration or the status machine changes.

## Threat model brought in line

`documentation/security/threat-model.md` no longer says "None (not built)" anywhere. Rows were rewritten from
the code and configuration, each with a `file:line`, and `Gap` marks a control nothing in the repository provides.

- **Attendee app and registration service:** attendee-only guard, UUID validation, own-only reads, `no-store`,
  a rate limiter before authentication, the waiting room. Gap: no sign-up rule, and no Cerbos call.
- **API gateway:** the Caddy allow-list and the in-process limiters are in force; Kong's JWT, rate-limiting and
  size limit are built but run nowhere. Gap: no request-size limit on the VM path.
- **Workflow workers:** Temporal Cloud TLS and key, loopback-only dev server on the VM. Gaps: no
  authentication on the VM's Temporal, and its SQLite state is lost on a redeploy.
- **Policy decision point (Cerbos):** fail closed with a 2 second timeout, local-policies fallback refused in
  production, policies compiled and tested at image build, pinned by digest, uid 10001. Gaps: audit logging off,
  no CODEOWNERS, no credential on the call, registration and notification never ask it.
- **Core database:** row-level security on `event.events` and `event.assignments` (migration 0025), replacing the
  old "no `create policy` anywhere" row. Gap: no RLS on the other schemas.
- **Event log:** Redpanda on the VM is loopback, SASL and TLS with a password generated at each start.
- **New sections:** the Vercel-hosted SPA (exact-origin CORS, report-only CSP, Git deployments off), the Azure
  VM deployment (forced-command SSH keys, digest-only gate, cosign verify, `cp` plus `chmod 660` env file;
  gaps: `cs-deploy` in the docker group, port 22 open to all, settings visible to every process), OpenTelemetry
  (nothing exported until `OTEL_EXPORTER_OTLP_ENDPOINT` is set, which no deployment does; SQL spans carry no
  values), and CI and the supply chain (gitleaks, CodeQL, Trivy, SBOMs, cosign, pinned actions; gap: no
  Dependabot).
- **Top gaps:** G1 and G2 are closed in code (async error patch; limiters on the event and notification
  routers), G4 is capped at 1,000,000 seats, G5 and G9 are reworded for what now exists.

## Diagram corrections (hand-written diagrams checked against the code)

- **Booking and slot:** a hold's slot is confirmed when the converted request is approved, not at conversion; a
  pending request is also withdrawn when its event is cancelled; a held slot is also released by the request's
  withdrawal or rejection.
- **Hold:** a Requested hold is also released when the event is cancelled; expiry is reached by the timer, the
  `jobs:expire-holds` sweep or a slot insert; conversion keeps the slot Held under the request's reference.
- **Waitlist:** nothing is promoted automatically. An entry becomes Registered when the attendee registers or is
  added, a leaver is Withdrawn (the status in the code), and a freed place only notifies the waiting attendees.

## Not done

- Citation lines in the threat model outside the sections above were not re-read; the script test only checks
  that a cited line exists. The G3, G6 to G8 and G10 to G15 rows were not re-verified in this change.
- The `check-docs` script test cannot run on Windows until PR #100 lands (a CRLF fragment); it runs in CI.
