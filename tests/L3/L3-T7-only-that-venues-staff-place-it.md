# L3-T7 — Only Venue Staff who look after the venue can place a hold on it; a coordinator cannot

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T7 |
| Test Scenario | Only Venue Staff who look after the venue can place a hold on it; a coordinator cannot |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. As the assigned coordinator, request a hold as in L3-T1 but for `Mochtar Riady Hall` (not looked after by `venuestaff@`). Note its id. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test` and open "Hold requests".<br>2. In the API console, as `venuestaff@`, `POST /venue/api/v1/holds/<HOLD_ID>/place` with `{"expiresAt":"2026-12-01T18:00+08:00"}`.<br>3. As the assigned coordinator, the same request. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 doesn't list the Mochtar Riady Hall hold. Step 2 answers 404 `HOLD_NOT_FOUND` (Venue Staff see only their venues' holds). Step 3 answers 403 `ROLE_NOT_AUTHORISED`. The hold stays Requested with no slot. |
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
