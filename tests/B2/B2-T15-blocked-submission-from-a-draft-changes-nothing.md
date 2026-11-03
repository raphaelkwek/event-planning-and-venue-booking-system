# B2-T15 — A blocked submission from a draft changes no stored value

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T15 |
| Test Scenario | A blocked submission from a draft changes no stored value |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → Event name `Partly planned symposium`, Expected attendance `100`, nothing else → "Save draft". The draft stays open in the editor. |
| Test Steps | 1. Change Expected attendance to the value in Test Data.<br>2. Click "Submit request".<br>3. Click "My requests".<br>4. Click "Open draft" on "Partly planned symposium". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Expected attendance: `200` |
| Expected Result | Step 2 is refused with `VALIDATION_FAILED`. In step 3 the row is still "Draft" with no reference. In step 4 Expected attendance shows `100` — the value saved before the blocked submission. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The refused submission left the draft's stored values and status unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B2-T15 a blocked submission from a draft changes no stored value, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |