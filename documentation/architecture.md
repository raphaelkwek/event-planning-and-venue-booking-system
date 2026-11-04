# Architecture diagrams

**Author:** Joash · **Updated:** 2026-11-04 · **Decisions:** ADR-0004 to ADR-0016 (`documentation/adr/`)

This is the index to ConnectSphere's design diagrams. The sources are in git and every image is rendered in CI by [`.github/workflows/diagrams.yml`](../.github/workflows/diagrams.yml).

| Kind | Where | Source of truth |
|---|---|---|
| C4 model: context, containers, components, dynamic and deployment views | [`c4/README.md`](c4/README.md) lists every view | [`c4/connectsphere.dsl`](c4/connectsphere.dsl), written by hand |
| Data model (ER), one per bounded context | below | the migrations, generated |
| Domain model (classes) | below | the modules' domain code, written by hand |
| State machines: event, booking, hold, registration | below | event: generated from `statusMachine.ts`; the others by hand |
| API | [`api/`](api/) (OpenAPI) | the routes, checked by `npm run lint:api` |

## C4 model

Start with [`c4/README.md`](c4/README.md). It covers three deployables (planning-core, registration, notification), the Temporal worker, Cerbos, Kafka (Redpanda in staging and production), Supabase per environment, the Vercel SPA, the Azure VM, OpenTelemetry to Grafana Cloud, and Kong, which is built and tested in CI only.

Staging and production are the Azure VM deployment of ADR-0016 (its Azure amendment): [staging](c4/images/structurizr-StagingDeployment.svg) and [production](c4/images/structurizr-ProductionDeployment.svg).

## Data model (ER)

One diagram per schema. Each is generated from the migrations by `documentation/scripts/generate-er-diagrams.ts`, which replays `CREATE TABLE`, `ALTER TABLE` and `DROP TABLE` in the order `migrate:all` applies them. A schema has no foreign keys to another schema: the modules and services reference each other by id only (ADR-0004, ADR-0005).

| Schema | Owner | Diagram | Source |
|---|---|---|---|
| identity | planning-core | [SVG](architecture/images/identity-schema.svg) | [`architecture/data-model/identity.puml`](architecture/data-model/identity.puml) |
| event | planning-core | [SVG](architecture/images/event-schema.svg) | [`architecture/data-model/event.puml`](architecture/data-model/event.puml) |
| venue | planning-core | [SVG](architecture/images/venue-schema.svg) | [`architecture/data-model/venue.puml`](architecture/data-model/venue.puml) |
| equipment | planning-core | [SVG](architecture/images/equipment-schema.svg) | [`architecture/data-model/equipment.puml`](architecture/data-model/equipment.puml) |
| change | planning-core | [SVG](architecture/images/change-schema.svg) | [`architecture/data-model/change.puml`](architecture/data-model/change.puml) |
| registration | registration-service | [SVG](architecture/images/registration-schema.svg) | [`architecture/data-model/registration.puml`](architecture/data-model/registration.puml) |
| notification | notification-service | [SVG](architecture/images/notification-schema.svg) | [`architecture/data-model/notification.puml`](architecture/data-model/notification.puml) |

## Domain model and state machines

| Diagram | What it shows | Source |
|---|---|---|
| [Domain model](architecture/images/domain-model.svg) | The main aggregates of each module and of the registration service, their statuses, and the references by id between them | [`architecture/domain/domain-model.puml`](architecture/domain/domain-model.puml) |
| [Event status](architecture/images/event-status.svg) | Every F1 transition, with its action | [`architecture/domain/event-status.puml`](architecture/domain/event-status.puml), generated |
| [Booking](architecture/images/booking-states.svg) | Booking request and the venue slot it books | [`architecture/domain/booking-states.puml`](architecture/domain/booking-states.puml) |
| [Hold](architecture/images/hold-states.svg) | Requested, held, converted, released, expired | [`architecture/domain/hold-states.puml`](architecture/domain/hold-states.puml) |
| [Registration](architecture/images/registration-states.svg) | Registration and waitlist entry | [`architecture/domain/registration-states.puml`](architecture/domain/registration-states.puml) |

## Keeping them current

```sh
npm run diagrams:er             # rewrite the ER sources from the migrations
npm run diagrams:states         # rewrite the event status diagram from statusMachine.ts
npm run diagrams:er:check       # fail if they are stale (the Diagrams workflow runs both checks)
npm run diagrams:states:check
```

The unit tests (`npm run test:scripts`) fail on a stale generated file too, so a migration or a new event transition cannot merge without its diagram. Images are not compared: to refresh them, download the `architecture-diagrams` artifact of the Diagrams run and copy the files into `documentation/architecture/images/`:

```sh
gh run download <run-id> --name architecture-diagrams --dir documentation/architecture/images
gh run download <run-id> --name c4-diagrams --dir documentation/c4/images
```

Change a hand-written diagram in the same pull request as the code it describes.
