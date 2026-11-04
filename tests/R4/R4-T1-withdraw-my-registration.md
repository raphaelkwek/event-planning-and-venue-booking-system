# R4-T1 — Happy path: an attendee withdraws their registration after confirming; it becomes Withdrawn with its timestamp and is kept

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T1 |
| Test Scenario | Happy path: an attendee withdraws their registration after confirming; it becomes Withdrawn with its timestamp and is kept |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. R2-T1 steps 1–2 done. |
| Test Steps | 1. Click "My registrations".<br>2. Click "Withdraw" on `R Test Symposium`.<br>3. In the dialog, click "Withdraw registration".<br>4. In the SQL editor run `select status, registered_at, withdrawn_at from registration.registrations where attendee_id = '00000000-0000-0000-0000-000000000005';` |
| Test Data | The registration from R2-T1 |
| Expected Result | Step 2 opens a dialog that says the place will be released. After step 3 the row shows `Withdrawn` and `Withdrawn <day>, <time>`, and no "Withdraw" button. Step 4 returns the row with status `WITHDRAWN` and a `withdrawn_at` later than `registered_at`: it was not deleted. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | My registrations → Withdraw opened a dialog saying the place will be released; confirming returned 200 and the row showed Withdrawn and `Withdrawn <day>, <time>` with no Withdraw button; SQL returned the row with status WITHDRAWN and withdrawn_at later than registered_at (not deleted). Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R4-T1 an attendee withdraws their registration after confirming; it becomes Withdrawn and is not deleted, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
