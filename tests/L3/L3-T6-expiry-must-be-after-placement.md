# L3-T6 — An expiry at or before the moment of placing is refused; one a minute later is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T6 |
| Test Scenario | An expiry at or before the moment of placing is refused; one a minute later is accepted |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T1 step 1 done. Note the hold's id. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, in the API console, `POST /venue/api/v1/holds/<HOLD_ID>/place` with `{"expiresAt":"<a minute ago>"}`.<br>2. Again with no `expiresAt`.<br>3. Again with `expiresAt` 2 minutes from now. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Times with their offset, e.g. `2026-10-19T15:04+08:00` |
| Expected Result | Steps 1 and 2 answer 400 `VALIDATION_FAILED` on `expiresAt`, "The expiry must be later than now." / "Enter the expiry date and time.", and the hold stays Requested with no slot. Step 3 answers 200 with the hold Held and that expiry. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
