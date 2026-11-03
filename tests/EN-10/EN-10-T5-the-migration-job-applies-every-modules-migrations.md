# EN-10-T5 — The migration Job runs `npm run migrate -- all` against the database before the workloads, and a second run applies nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T5 |
| Test Scenario | The migration Job runs `npm run migrate -- all` against the database before the workloads, and a second run applies nothing |
| Pre-conditions | 1. The `Image (migrate)` and `kind smoke deploy (staging overlay)` jobs run. |
| Test Steps | 1. In `Image (migrate)`, check the smoke step applied the migrations to an empty Postgres and a second run applied none.<br>2. In the kind job, check the `migrate` Job reached `Complete` before the Rollouts were awaited and that planning-core's `/readyz` then answered. |
| Test Data | An empty Postgres; the migrations of identity, event, venue, equipment, change, notification and registration. |
| Expected Result | Both jobs pass. The Job's pod ran non-root with a read-only filesystem. |
| Acceptance criterion | A migration Job or initContainer using `npm run migrate`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Image (migrate) applied all modules to an empty Postgres and a second run applied none; in kind the migrate Job completed before the Rollouts and planning-core then reported database ok. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › jobs 'Image (migrate)' and 'kind smoke deploy (staging overlay)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
