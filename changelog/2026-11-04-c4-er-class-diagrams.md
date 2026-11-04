# Architecture diagrams: C4 brought up to date, generated ER diagrams, domain and state diagrams

**Timestamp:** 2026-11-04T09:05+08:00 (SGT)
**Author:** Joash
**Scope:** `documentation/c4/connectsphere.dsl` and its README; new `documentation/architecture.md` and
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

## Not done

- `documentation/security/threat-model.md` still says the containers that were tagged "Planned" are "None
  (not built)". Its rows need rewriting by someone who re-checks each control; the check in
  `check-docs.test.ts` still passes because the container ids did not change.
