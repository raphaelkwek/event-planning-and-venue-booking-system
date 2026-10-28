# I5-T8 — The assigned coordinator's notification says the block has no end

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T8 |
| Test Scenario | The assigned coordinator's notification says the block has no end |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with its coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 150, 2 December 2026 14:00–18:00 approved (M1).<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Record a block from 2 December 2026 13:00 with no end, Maintenance, `Roof leak repair`, confirming the review.<br>2. Sign in as the event's assigned coordinator and open Notifications. |
| Test Data | Block from 2 December 13:00, no end |
| Expected Result | An unread notification names `Lee Kong Chian Auditorium`, that it is unavailable from Wednesday 2 December 2026, 13:00 until Venue Staff lift it, the reason Maintenance and `Roof leak repair`, the booking reference and the event reference, and says alternative arrangements are required. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | An unread notification read: "Lee Kong Chian Auditorium is unavailable from Wednesday 2 December 2026, 13:00 until Venue Staff lift it (Maintenance: Roof leak repair), which disrupts booking BKR-003882 for EVT-013120 “Annual Research Symposium”. The booking requires reconfirmation, and alternative arrangements are required.10/24/2026, 3:48:18 AMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: 44bda64 · Evidence: tests/I5/evidence/I5-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
