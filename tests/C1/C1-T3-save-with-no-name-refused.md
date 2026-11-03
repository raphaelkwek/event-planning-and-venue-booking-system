# C1-T3 — Saving with no event name is refused (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T3 |
| Test Scenario | Saving with no event name is refused (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Test Data.<br>3. Click "Save draft".<br>4. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: *(empty)* · Purpose: `Share faculty research` |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED` "This draft could not be saved.", and "Event name is required." appears under Event name. Step 4 shows no new row. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "Event name is required." on the field; no draft stored. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › C1-T3 saving with no event name is refused, and nothing is stored, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
