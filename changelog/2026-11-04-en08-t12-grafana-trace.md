# EN-08-T12 recorded: Grafana Cloud shows one approval as one trace

**Timestamp:** 2026-11-04T14:00+08:00 (SGT)
**Author:** Joash
**Reason:** EN-08's last open card waited on a Grafana Cloud account. With #114, staging and
production export their traces and metrics to Joash's stack, so the card could be run.
**Scope:** `tests/EN-08/EN-08-T12-…md`, `documentation/evidence/EN-08/`, the EN-08 traceability file.
No code.

## Tested

- **EN-08-T12, Pass.** A D4 approval on staging (d1e6c08) has `x-correlation-id`
  `a82bfe6d7c1bd4bc00d597a94ff1ac66`. In Grafana Explore → Tempo it is one trace: 38 spans across
  `planning-core`, `notification`, `registration` and `planning-core-worker`. It starts at
  `POST /api/v1/events/:id/approve` and runs through the transactions and the outbox insert, then the
  three `connectsphere.event.v1 publish` spans, then each consumer's `process` span and its
  transaction. Every resource carries `deployment.environment=staging`.
- It was run on staging rather than a laptop. The approval went through the API as the coordinator,
  and Joash read the trace and took the screenshot
  (`documentation/evidence/EN-08/EN-08-T12-grafana-trace-2026-11-04.png`). The card's remarks say so.
- With this card, every EN-08 card passes.

## Also set up on 4 Nov (outside the repo)

- In Grafana, a **ConnectSphere** folder holds the five EN-17 SLO dashboards from
  `observability/grafana/dashboards/` and a live overview. The EN-17 recording and alert rules from
  `observability/prometheus/rules/` were loaded into the stack's Prometheus (namespace `connectsphere`).
  A read-only, no-login copy of the overview is shared with the team.
