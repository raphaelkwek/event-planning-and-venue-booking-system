# C2-T3 — Submitting a complete draft moves it to Submitted and records the submission time

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T3 |
| Test Scenario | Submitting a complete draft moves it to Submitted and records the submission time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → enter the standard request → "Save draft". |
| Test Steps | 1. Click "My requests", then "Open draft" on "Annual Research Symposium".<br>2. Click "Submit request".<br>3. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 opens the request page with status "Submitted", a reference of the form `EVT-` followed by six digits, and a submission time. Step 3 shows exactly one "Annual Research Symposium" row, with status "Submitted" and a "View" link rather than "Open draft". |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The complete draft submitted and showed Submitted with its submission time. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › C2-T3 submitting a complete draft moves it to Submitted, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
