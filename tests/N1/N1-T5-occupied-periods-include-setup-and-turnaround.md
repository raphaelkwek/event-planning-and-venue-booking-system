# N1-T5 — CR-01: periods are compared as occupied periods: 10:00–12:00 with 30 minutes' setup and 45 minutes' turnaround occupies 09:30–12:45, and an occupied period that only touches it is permitted

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T5 |
| Test Scenario | CR-01: periods are compared as occupied periods: 10:00–12:00 with 30 minutes' setup and 45 minutes' turnaround occupies 09:30–12:45, and an occupied period that only touches it is permitted |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 10:00, end 12:00, setup 30 and turnaround 45.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 12:30–14:00. Note its booking reference.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the 12:30 request and "Approve request".<br>2. As the assigned coordinator, withdraw that request and request the venue again for 12:45–14:00.<br>3. As `venuestaff@connectsphere.test`, approve the 12:45 request. |
| Test Data | Account: `venuestaff@connectsphere.test` and the assigned coordinator · The other booking is 10:00–12:00, occupying 09:30–12:45 |
| Expected Result | Step 1 is refused; the message names the other event and its occupied period, 09:30–12:45, including setup and turnaround. Step 3 goes through: 12:45 is exactly where the other booking's turnaround ends. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Approving 12:30–14:00 was refused: "BKR-000519 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-008069 (Wednesday 2 December 2026, 09:30–12:45), counting setup and turnaround time. Nothing was approved, and the request is still Pending." After withdrawing it, the coordinator's 12:45–14:00 request BKR-000520 was approved. |
| Status | Pass |
| Remarks | Commit: 7c418d5 · Evidence: tests/N1/evidence/N1-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
