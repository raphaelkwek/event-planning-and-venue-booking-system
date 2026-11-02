# R4-T11 — Withdraw asks for confirmation; keeping the place changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T11 |
| Test Scenario | Withdraw asks for confirmation; keeping the place changes nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. R2-T1 steps 1–2 done. |
| Test Steps | 1. Click "My registrations" and click "Withdraw".<br>2. In the dialog, click "Keep my place". |
| Test Data | One Registered registration |
| Expected Result | The dialog restates what will happen before anything changes. After step 2 the dialog closes and the row still shows `Registered` with its "Withdraw" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by frontend/tests/attendeeRegistration.test.tsx › R4-T11 keeping the place closes the dialog and changes nothing (against a stubbed API), passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513315276 (commit d43fab5). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
