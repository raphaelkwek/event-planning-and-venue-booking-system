# L1-T1 — The assigned coordinator requests a venue for an Approved event, and the request is stored Pending with its coordinator, time and a unique booking reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T1 |
| Test Scenario | The assigned coordinator requests a venue for an Approved event, and the request is stored Pending with its coordinator, time and a unique booking reference |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's reference and which coordinator is assigned.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the request from "All events" and click "Venue requests".<br>2. Click "Request a venue".<br>3. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Theatre`, leave the other fields as filled in, and click "Submit request". |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` · The standard request: 2 December 2026, 14:00–18:00, attendance 150 |
| Expected Result | The "Venue requests" screen shows "Booking request BKR-… submitted." and lists one request: its booking reference (`BKR-` and six digits), `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00, Theatre, 150, status Pending. In the SQL editor the request names the assigned coordinator as requester and a request time within the last minute. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Booking request BKR-001122 submitted." was shown, and the list showed "BKR-001122Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150PendingWithdraw". The database names coordinator@connectsphere.test as requester at 2026-10-19T08:20:28.098Z. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/L1/evidence/L1-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
