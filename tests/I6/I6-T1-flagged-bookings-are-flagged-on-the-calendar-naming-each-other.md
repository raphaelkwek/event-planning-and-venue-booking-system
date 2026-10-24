# I6-T1 — Two confirmed bookings a change of turnaround time makes overlap are each shown flagged on the calendar, naming the other

## Specification

| Item | Content |
|---|---|
| Test Case ID | I6-T1 |
| Test Scenario | Two confirmed bookings a change of turnaround time makes overlap are each shown flagged on the calendar, naming the other |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-OVERLAP completed (`tests/I6/README.md`): bookings at `Lee Kong Chian Auditorium` on 2 December 2026, 10:00–12:00 (`<REF-1>`, `<EVT-1>`) and 12:15–14:00 (`<REF-2>`, `<EVT-2>`), then its turnaround time set to 30 minutes (H3).<br>3. Signed in as the coordinator of `<EVT-1>`. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s availability and show 2 December 2026 to 2 December 2026.<br>2. Read the two bookings' rows. |
| Test Data | Turnaround 30 minutes; bookings 10:00–12:00 and 12:15–14:00 |
| Expected Result | The 10:00–12:00 row reads "Confirmed `<EVT-1>`" and "Requires reconfirmation: overlaps `<REF-2>` (`<EVT-2>`) with the venue's setup and turnaround time". The 12:15–14:00 row reads the same, naming `<REF-1>` (`<EVT-1>`). Both are shown in the flagged appearance, unlike an unflagged booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
