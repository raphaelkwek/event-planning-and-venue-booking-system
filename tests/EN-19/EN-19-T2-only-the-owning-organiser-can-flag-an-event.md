# EN-19-T2 — Only the owning organiser can flag an event; a stale version, a missing version, a bad value and a closed event are refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T2 |
| Test Scenario | Only the owning organiser can flag an event; a stale version, a missing version, a bad value and a closed event are refused |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. An Approved event owned by Organiser One; a second organiser; a coordinator. |
| Test Steps | 1. Run `npm test -w @connectsphere/planning-core`.<br>2. Find the tests named `EN-19-T2`, in `highDemand.test.ts`. |
| Test Data | As the second organiser; as a coordinator; with a stale If-Match; with no If-Match; with {"highDemand": "yes"}; on a Completed event |
| Expected Result | The second organiser gets 404 (the event is not theirs to see); the coordinator 403; a stale version 412 `EVENT_VERSION_MISMATCH`; no If-Match 428; a non-boolean 400 `VALIDATION_FAILED` naming `highDemand`; a Completed event 409 `EVENT_NOT_EDITABLE`. After each, the flag, the version and the outbox are unchanged. |
| Acceptance criterion | An organiser can mark an event high-demand; access is enforced on the server. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The second organiser got 404, the coordinator 403, a stale version 412, no If-Match 428, a non-boolean and an extra field 400 naming the field, a Completed event 409; the flag, version, history and outbox were unchanged after each. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/planning-core/tests/event/api/highDemand.test.ts › EN-19-T2 refuses everyone but the owner, a stale or missing version, a bad value and a closed event, changing nothing || backend/services/planning-core/tests/event/domain/highDemand.test.ts › names the field when it is missing or not a boolean (EN-19-T2), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
