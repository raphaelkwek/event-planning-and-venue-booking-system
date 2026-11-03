# C2-T4 — Submitting an incomplete draft applies the full submission validation

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T4 |
| Test Scenario | Submitting an incomplete draft applies the full submission validation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Only a name` completed.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "My requests", then "Open draft" on "Only a name".<br>2. Click "Submit request".<br>3. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 is refused with `VALIDATION_FAILED`, naming Purpose, Description, Proposed start, Proposed end and Expected attendance at once. Step 3 still shows "Only a name" as a Draft with no reference. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The incomplete draft was refused with every missing field named; it stayed a Draft. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › C2-T4 submitting an incomplete draft applies the full submission validation, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
