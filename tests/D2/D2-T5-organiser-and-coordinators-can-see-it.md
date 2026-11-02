# D2-T5 — The clarification is visible to the owning organiser and to Event Coordinators

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T5 |
| Test Scenario | The clarification is visible to the owning organiser and to Event Coordinators |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request id; sign out. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`, click "My requests", then "View" on the request.<br>2. Sign out, sign in as `coordinator2@connectsphere.test`, and go to http://localhost:5173/#/review/<id>. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator2@connectsphere.test` — both `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "Coordinator asked" shows "Please confirm the expected attendance." with "Awaiting your response". In step 2 the same message appears under "Clarifications". |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser and both coordinators saw the clarification text. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D2-T5 the clarification is visible to the owning organiser and to Event Coordinators, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
