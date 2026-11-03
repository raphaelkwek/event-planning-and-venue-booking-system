# C1-T1 — Save a draft with only the event name

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T1 |
| Test Scenario | Save a draft with only the event name |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Event name and leave every other field empty.<br>3. Click "Save draft". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: `Untitled idea` |
| Expected Result | "Saved as a draft at" followed by the time appears. The heading changes to "Edit draft" and the address bar ends in `#/drafts/<id>`. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The draft saved with only its name and showed status Draft. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › C1-T1 a draft is saved with only the event name, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
