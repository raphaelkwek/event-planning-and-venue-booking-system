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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
