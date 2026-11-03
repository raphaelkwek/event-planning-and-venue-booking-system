# C2-T1 — Reopening a draft restores every saved field exactly

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T1 |
| Test Scenario | Reopening a draft restores every saved field exactly |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → enter the standard request with the changes in Test Data → "Save draft". |
| Test Steps | 1. Click "My requests".<br>2. Click "Open draft" on "Annual Research Symposium". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Equipment is required: ticked · Attendee registration is required: ticked · Registration opens: 20 November 2026, 09:00 · Registration closes: 1 December 2026, 17:00 |
| Expected Result | Every field shows exactly the value saved: the standard request's name, purpose, description, start, end, attendance and accessibility needs, both checkboxes ticked, and both registration dates and times. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Reopened from My requests, every saved field showed exactly the value saved. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › C2-T1 reopening a draft restores every saved field exactly, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
