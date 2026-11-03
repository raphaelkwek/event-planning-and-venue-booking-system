# D1-T4 — Opening a request shows its full submitted content, read-only, including requirements

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T4 |
| Test Scenario | Opening a request shows its full submitted content, read-only, including requirements |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED, also entering the venue and equipment requirements in Test Data before "Submit request". |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue", then "Open" on "Annual Research Symposium". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Room layout: `Theatre` · Facilities: `Projector, Microphone` · Equipment is required: ticked · Equipment line: `Wireless microphone`, quantity `4` |
| Expected Result | The screen shows the purpose, description, proposed start and end, expected attendance 150, accessibility needs "Step-free access to the stage", venue requirements "Room layout: Theatre" and "Facilities: Projector, Microphone", and equipment requirements "4 × Wireless microphone". None of them can be edited on this screen. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review screen showed every submitted field, including requirements, with no editable field. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D1-T4 opening a request shows its full submitted content, read-only, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
