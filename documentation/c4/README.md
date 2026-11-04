# C4 architecture diagrams

**Author:** Joash · **Jira:** EN-09 (SPM-127) · **Decisions:** ADR-0004 to ADR-0016

`connectsphere.dsl` is the C4 model, in [Structurizr DSL](https://docs.structurizr.com/dsl). It's the source; the images in `images/` are generated from it. Change the model in the same pull request as the code it describes.

## The views

| Image | Level | What it shows |
|---|---|---|
| `images/structurizr-SystemContext.png` | 1, context | The seven roles, ConnectSphere, Supabase Auth, Grafana Cloud and the (unbuilt) email provider |
| `images/structurizr-Containers.png` | 2, containers | The deployables and data stores, as built |
| `images/structurizr-PlanningCoreComponents.png` | 3, components | planning-core's five modules, and how they call each other (ADR-0004) |
| `images/structurizr-CancelEvent.png` | dynamic | F3/F4 cancellation: one core transaction, then the other services act on `event.cancelled` (ADR-0009 note) |
| `images/structurizr-Register.png` | dynamic | R2 registration: claim a seat row, outbox, notification (ADR-0005, ADR-0008) |
| `images/structurizr-SafetyCheck.png` | dynamic | U1 Operational Safety Check between confirmed arrangements and preparation (CR-06) |
| `images/structurizr-HoldExpiry.png` | dynamic | L6 hold expiry and reminder, as a Temporal timer started from the venue-booking topic (CR-04, ADR-0009) |
| `images/structurizr-LocalDevelopment.png` | deployment | `npm run dev` against the hosted Supabase, Kafka and Temporal |
| `images/structurizr-StagingDeployment.png` | deployment | Staging: Vercel SPA, one Azure VM running the backend container (Redpanda, Temporal, Cerbos), its own Supabase project (ADR-0016) |
| `images/structurizr-ProductionDeployment.png` | deployment | Production: the same image and layout, on the same VM, with its own Vercel and Supabase projects |
| `images/structurizr-CiDeployment.png` | deployment | What CI runs, including the Kong gateway stack, which runs nowhere else |
| `images/structurizr-AwsScaleUpDeployment.png` | deployment | The unprovisioned AWS scale-up path (EN-10), kept as code |

Each view also has a `-key` image, its legend. SVG copies sit beside the PNGs.

**Dashed means not built.** Two things carry the `Planned` tag: the email provider (notifications are in-app only) and the AWS scale-up. A dotted border (`CiOnly`) marks Kong: its configuration is built and exercised in CI (`gateway.yml`) but no deployed environment runs it; in development, staging and production the SPA calls the services directly. When something is built, delete its tag in the same pull request.

**Where the model departs from the earlier design, on purpose.** Cancellation is not a Temporal workflow (ADR-0009's implementation note), the workers run only CompleteEvent and HoldExpiry, the attendee app is routes of the same SPA rather than an installable PWA, and staging and production run on one Azure VM with in-container Redpanda and a Temporal dev server (ADR-0016 and its Azure amendment). The class, state and data-model diagrams are in [`../architecture.md`](../architecture.md).

## Updating the images

Structurizr needs Java 17 or newer, and local development doesn't use Docker, so CI renders the diagrams. Every pull request that touches `documentation/c4/` runs the **Diagrams** workflow (`.github/workflows/diagrams.yml`). It validates the model, exports each view to PlantUML, renders PNG and SVG, and uploads them as the `c4-diagrams` artifact.

To commit fresh images after changing the model:

```sh
gh run download <run-id> --name c4-diagrams --dir documentation/c4/images
```

The run id is on the pull request's Checks tab, or from `gh run list --workflow diagrams.yml --limit 1`. Then commit the changed files in `images/`.

A broken model fails the Validate step, so a pull request can't merge a model that doesn't parse.
