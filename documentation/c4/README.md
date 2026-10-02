# C4 architecture diagrams

**Author:** Joash · **Jira:** EN-09 (SPM-127) · **Decisions:** ADR-0004 to ADR-0015

`connectsphere.dsl` is the C4 model, in [Structurizr DSL](https://docs.structurizr.com/dsl). It's the source; the images in `images/` are generated from it. Change the model in the same pull request as the code it describes.

## The views

| Image | Level | What it shows |
|---|---|---|
| `images/structurizr-SystemContext.png` | 1, context | The five roles, ConnectSphere, Supabase Auth and email |
| `images/structurizr-Containers.png` | 2, containers | The deployables and data stores |
| `images/structurizr-PlanningCoreComponents.png` | 3, components | planning-core's five modules, and how they call each other (ADR-0004) |
| `images/structurizr-CancelEvent.png` | dynamic | F3/F4 cancellation: freeze, commit, finalise (ADR-0009) |
| `images/structurizr-Register.png` | dynamic | R2 registration: claim a seat row, outbox, notification (ADR-0005, ADR-0008) |
| `images/structurizr-SafetyCheck.png` | dynamic | U1 Operational Safety Check between confirmed arrangements and preparation (CR-06) |
| `images/structurizr-HoldExpiry.png` | dynamic | L6 tentative hold expiry and reminder, as a Temporal timer (CR-04, ADR-0009) |
| `images/structurizr-LocalDevelopment.png` | deployment | What runs today: `npm run dev` against hosted Supabase and Kafka |
| `images/structurizr-ProductionDeployment.png` | deployment | The target on AWS (ADR-0012, Tier 2) |

Each view also has a `-key` image, its legend. SVG copies sit beside the PNGs.

**Dashed means planned.** An element tagged `Planned` is designed but not built yet, and its technology names the enabler that builds it, such as "(EN-13)". When that enabler lands, delete the tag in the same pull request.

## Updating the images

Structurizr needs Java 17 or newer, and local development doesn't use Docker, so CI renders the diagrams. Every pull request that touches `documentation/c4/` runs the **Diagrams** workflow (`.github/workflows/diagrams.yml`). It validates the model, exports each view to PlantUML, renders PNG and SVG, and uploads them as the `c4-diagrams` artifact.

To commit fresh images after changing the model:

```sh
gh run download <run-id> --name c4-diagrams --dir documentation/c4/images
```

The run id is on the pull request's Checks tab, or from `gh run list --workflow diagrams.yml --limit 1`. Then commit the changed files in `images/`.

A broken model fails the Validate step, so a pull request can't merge a model that doesn't parse.
