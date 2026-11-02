# R1-T5 — Boundary: an event whose registration closes in one minute is listed; one that closed one minute ago is not

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T5 |
| Test Scenario | Boundary: an event whose registration closes in one minute is listed; one that closed one minute ago is not |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run twice: once named `R Closes Soon` with `<CLOSES>` = `now() + interval '1 minute'`, once named `R Closed` with `<CLOSES>` = `now() - interval '1 minute'`.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events" within a minute of step 2.<br>2. Look for both events. |
| Test Data | `R Closes Soon`: closes one minute after the fixture runs · `R Closed`: closed one minute before |
| Expected Result | `R Closes Soon` is listed. `R Closed` is not. (The exact closing instant itself is checked by the automated test, which fixes the clock: an event whose closing is exactly now is still listed, because it has not passed.) |
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
