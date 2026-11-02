# R4-T10 — Registering again after withdrawing creates a new registration, subject to the same capacity and window rules

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T10 |
| Test Scenario | Registering again after withdrawing creates a new registration, subject to the same capacity and window rules |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. R4-T1 done. Note the withdrawn reference. |
| Test Steps | 1. Open `R Test Symposium` from "Events" and click "Register".<br>2. Click "My registrations". |
| Test Data | The withdrawn registration from R4-T1 |
| Expected Result | Step 1 shows "You are registered" with a new reference, different from the withdrawn one. Step 2 lists both: the old one `Withdrawn`, the new one `Registered`. (The automated test also shows a re-registration is refused for capacity when the place was taken meanwhile, and outside the window.) |
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
