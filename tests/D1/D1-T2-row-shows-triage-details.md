# D1-T2 — Each queue row shows the details a coordinator triages on

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T2 |
| Test Scenario | Each queue row shows the details a coordinator triages on |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". Do not open the request. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The row shows the noted reference, name "Annual Research Symposium", proposed date and time 2 December 2026, 14:00, expected attendance 150, the submitting organiser "Organiser One", the submission date and time, and status "Submitted". |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The row showed reference, name, proposed start, attendance 150, "Organiser One", submission time and status Submitted. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D1-T2 each queue row shows the details a coordinator triages on, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
