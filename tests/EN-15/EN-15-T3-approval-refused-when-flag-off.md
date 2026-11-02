# EN-15-T3 — S2 approve is refused server-side when change-approval is off

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T3 |
| Test Scenario | S2 approve is refused server-side when change-approval is off |
| Pre-conditions | 1. Throwaway Postgres migrated with npm run migrate:all (CI).<br>2. A Pending change request on an event assigned to coordinator C1.<br>3. change-approval set off. |
| Test Steps | 1. Sign in as C1.<br>2. POST /api/v1/change-requests/{id}/decision with { decision: 'APPROVE' }.<br>3. Read the change request and the event. |
| Test Data | A change raising expected attendance 150 to 180. |
| Expected Result | 403 with error.code FEATURE_DISABLED and a clear message naming the change-approval flag. The change request is still PENDING and the event is unchanged (attendance 150). |
| Acceptance criterion | When off, approval is refused on the server, not only hidden. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the flag off, POST decision APPROVE returned 403 FEATURE_DISABLED naming change-approval; the request stayed PENDING and the event's attendance and version were unchanged. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/change/api/en15Cards.test.ts › EN-15-T3 refuses an approval on the server while the flag is off, and changes nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
