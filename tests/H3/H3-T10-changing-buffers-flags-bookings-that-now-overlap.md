# H3-T10 — Changing a venue's buffers flags the bookings that now overlap, removing none

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T10 |
| Test Scenario | Changing a venue's buffers flags the bookings that now overlap, removing none |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. Two confirmed bookings of the venue on one day: 10:00–12:00 and 12:15–14:00 (M1). |
| Test Steps | 1. As Venue Staff, set the turnaround time to `30` minutes and save.<br>2. Open both bookings. |
| Test Data | Turnaround `30` |
| Expected Result | Both bookings are flagged Requires Reconfirmation, each naming the other as the overlapping reference, and each coordinator is notified. Neither booking is removed, released or moved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After saving turnaround 30, the editor read "Venue saved. With the new setup and turnaround time, these now overlap and require reconfirmation:Booking BKR-002616 (EVT-011451) overlaps BKR-002617Booking BKR-002617 (EVT-011452) overlaps BKR-002616Their coordinators have been told. Nothing was removed, released or moved.". The coordinators' rows read "BKR-002616Lee Kong Chian AuditoriumWednesday 2 December 2026, 10:00–12:00Confirmed Requires reconfirmationOverlaps BKR-002617 with the venue's new setup and turnaround timeFind a replacement" and "BKR-002617Lee Kong Chian AuditoriumWednesday 2 December 2026, 12:15–14:00Confirmed Requires reconfirmationOverlaps BKR-002616 with the venue's new setup and turnaround timeFind a replacement", and each had a notification: "Lee Kong Chian Auditorium now needs 0 minutes of setup and 30 minutes of turnaround, so booking BKR-002616 for EVT-011451 “Annual Research Symposium” now overlaps BKR-002617. The booking requires reconfirmation. It has not been removed, released or moved.10/20/2026, 11:53:43 PMUnreadOpenMark as read" / "Lee Kong Chian Auditorium now needs 0 minutes of setup and 30 minutes of turnaround, so booking BKR-002617 for EVT-011452 “Faculty Awards Night” now overlaps BKR-002616. The booking requires reconfirmation. It has not been removed, released or moved.10/20/2026, 11:53:43 PMUnreadOpenMark as read". Both bookings are still CONFIRMED with their periods unchanged. |
| Status | Pass |
| Remarks | Commit: 0eb3119 · Evidence: tests/H3/evidence/H3-T10.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |
