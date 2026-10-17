# N1-T1 — Approving a pending request for a free period confirms the booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T1 |
| Test Scenario | Approving a pending request for a free period confirms the booking |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's reference.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00. Note its booking reference.<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Click "Approve" on the request, then "Approve request" in the dialog.<br>3. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "BKR-… approved. The booking is confirmed." is shown and the request leaves the queue. The calendar shows `14:00–18:00` marked "Confirmed" and labelled with the event's reference. The coordinator's "Venue requests" shows the request as Approved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
