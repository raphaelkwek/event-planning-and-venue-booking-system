# D4-T6 — Approval alone creates no venue booking and no equipment reservation

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T6 |
| Test Scenario | Approval alone creates no venue booking and no equipment reservation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `venuestaff@connectsphere.test`. Open the booking list.<br>2. Sign out, sign in as `techsupport@connectsphere.test`, and open the reservation list. |
| Test Data | Accounts: `venuestaff@connectsphere.test`, `techsupport@connectsphere.test` — both `ConnectSphere-Test-1234!` |
| Expected Result | Neither list contains a booking or reservation for the noted reference. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Blocked |
| Remarks | Blocked: the Venue and Equipment services are not built, so there are no bookings or reservations to check. |
| Executed By | |
| Date of Execution | |
