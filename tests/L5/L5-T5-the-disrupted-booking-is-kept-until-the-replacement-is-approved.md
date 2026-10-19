# L5-T5 — The disrupted booking is kept, still flagged, until the replacement is approved (M1); it is then released with the reason "replaced", and its record is kept

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T5 |
| Test Scenario | The disrupted booking is kept, still flagged, until the replacement is approved (M1); it is then released with the reason "replaced", and its record is kept |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. Note the disrupted booking's id.<br>3. The assigned coordinator has raised a replacement request for `Seminar Room 2-1`, Classroom, 2 December 2026 14:00–18:00, linked to the disrupted booking (the L5 replacement statement). |
| Test Steps | 1. In the SQL editor, read the disrupted booking: `select status, requires_reconfirmation, release_reason from venue.venue_slots where id = '<id>';`<br>2. As `venuestaff@connectsphere.test`, approve the replacement in "Booking requests".<br>3. Read the disrupted booking again.<br>4. As the assigned coordinator, open the event's "Venue requests". |
| Test Data | Accounts: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | Before the approval the booking is `CONFIRMED`, flagged, with no release reason. After it, the booking still exists, `RELEASED` with release reason `replaced`. The coordinator's "Bookings" show the old booking Released (replaced), with no action, and the new booking at `Seminar Room 2-1` Confirmed. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Before the approval the booking was CONFIRMED, flagged, with no release reason. After it, it was RELEASED with release reason "replaced". The coordinator's Bookings read "BKR-001361Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Released (replaced)Replacement BKR-001362 at Seminar Room 2-1: Approved" for the old booking, and showed the new one at Seminar Room 2-1 Confirmed. |
| Status | Pass |
| Remarks | Commit: a97986f · Evidence: tests/L5/evidence/L5-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
