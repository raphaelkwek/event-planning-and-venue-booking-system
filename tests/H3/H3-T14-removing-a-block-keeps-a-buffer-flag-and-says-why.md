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
| Actual Result | Ran in the browser on CI's throwaway stack (2 March 2027 in place of 2 December 2026, unique names). Two confirmed bookings, 10:00–12:00 (Coordinator One) and 12:15–14:00 (Coordinator Two); a Maintenance block 10:30–11:00 "Projector replacement" flagged the 10:00 booking (I2), and turnaround 30 then flagged both (H3-T10). Venue Staff opened the venue's Unavailability, clicked "Remove" on the block and "Remove unavailability" in the dialog "Remove this unavailability?", and saw "Unavailability removed.". The venue-booking.disruption-cleared message was delivered by the test harness in place of Kafka and stored. Coordinator One's Notifications read "The unavailability of <venue> on Tuesday 2 March 2027, 10:30–11:00 (Maintenance: Projector replacement) was removed. Booking BKR-… for EVT-… “…” still requires reconfirmation: with the venue's setup and turnaround time it still overlaps another booking, hold or request.", and did not say "other unavailability still overlaps it". The event's Venue requests still showed the 10:00 booking with "Requires reconfirmation" and "Overlaps BKR-… with the venue's new setup and turnaround time" naming the 12:15 booking, and no longer listed the block as disrupting it. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/h-venues.spec.ts › H3-T14 removing a block keeps the flag the venue's times still cause, and tells the coordinator why, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
