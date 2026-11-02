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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
