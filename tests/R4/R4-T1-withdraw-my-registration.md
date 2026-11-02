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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
