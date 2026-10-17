# M1-T1 — The queue shows the pending requests for the approver's own venues, with booking reference, event reference, date and period, layout, attendance and requesting coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T1 |
| Test Scenario | The queue shows the pending requests for the approver's own venues, with booking reference, event reference, date and period, layout, attendance and requesting coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's reference and its assigned coordinator.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00, and `Mochtar Riady Hall`, Theatre, at the same time. Note both booking references.<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · `venuestaff@` looks after `Lee Kong Chian Auditorium`, not `Mochtar Riady Hall` |
| Expected Result | The queue lists the `Lee Kong Chian Auditorium` request with its booking reference, the event's reference, Wednesday 2 December 2026 14:00–18:00, Theatre, 150 attending, and the requesting coordinator's name, with "Approve" and "Reject". The `Mochtar Riady Hall` request isn't listed. |
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
