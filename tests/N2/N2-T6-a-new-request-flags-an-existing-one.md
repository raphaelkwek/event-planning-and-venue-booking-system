# N2-T6 — Creating an overlapping request flags the request that was already pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T6 |
| Test Scenario | Creating an overlapping request flags the request that was already pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. N2-T1's pre-conditions 2 to 4 completed (request A only).<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests" and read request A's row.<br>2. As the other coordinator, request `Lee Kong Chian Auditorium`, Theatre, 16:00–20:00 for Faculty Awards Night (request B).<br>3. As `venuestaff@`, reload "Booking requests" and read request A's row. |
| Test Data | Request A 14:00–18:00 · Request B 16:00–20:00 |
| Expected Result | At step 1 request A shows no conflict. At step 3 it shows "Conflict", naming request B and 16:00–20:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
