# DEPLOY-T11 — The migrate Job applies every migration through MIGRATE_DATABASE_URL, and a second run applies nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T11 |
| Test Scenario | The migrate Job applies every migration through MIGRATE_DATABASE_URL, and a second run applies nothing |
| Pre-conditions | 1. The `kind: k3s staging overlay` job runs. |
| Test Steps | 1. Check the rendered migrate Job reads `MIGRATE_DATABASE_URL`, not `DATABASE_URL`.<br>2. Check the Job completed against the throwaway Postgres and logged applied migrations.<br>3. Run it again and check it applies nothing. |
| Test Data | Throwaway Postgres in the cluster. |
| Expected Result | Steps 1 to 3 hold. In each environment MIGRATE_DATABASE_URL is Supabase's session pooler (port 5432 on the pooler host): migrate.ts uses prepared statements, which the transaction pooler refuses, and the direct host is IPv6-only. |
| Acceptance criterion | Migrations run with the migrate Job against each environment's Supabase (session pooler, not the transaction pooler). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The rendered migrate Job read MIGRATE_DATABASE_URL; it completed against the throwaway Postgres and applied the migrations; a second Job made from it applied 0 files. |
| Status | Pass |
| Remarks | Automated (kind, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: job 'kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
