# H3-T14 — Removing a block keeps a flag the venue's buffers still cause, and says why

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T14 |
| Test Scenario | Removing an unavailability block keeps a flag the venue's buffers still cause, and the coordinator is told why |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. Two confirmed bookings of the venue on Wednesday 2 December 2026: 10:00–12:00 and 12:15–14:00 (L1, M1).<br>4. A block of unavailability over 10:30–11:00, Maintenance, "Projector replacement" (I2), which flags the 10:00 booking.<br>5. The turnaround time set to `30` and saved, which flags both bookings (H3-T10). |
| Test Steps | 1. As Venue Staff, open the venue's unavailability, click "Remove" on the block, then "Remove unavailability".<br>2. Sign in as the 10:00 booking's coordinator and open "Notifications", then the event's "Venue requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The 10:00 booking still shows "Requires reconfirmation" and "Overlaps BKR-…", naming the 12:15 booking. The coordinator is told "The unavailability of … on Wednesday 2 December 2026, 10:30–11:00 (Maintenance: Projector replacement) was removed. Booking BKR-… for EVT-… still requires reconfirmation: with the venue's setup and turnaround time it still overlaps another booking, hold or request." It does **not** say "other unavailability still overlaps it", because none does. |
| Created By | Sahanya, via Claude |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
