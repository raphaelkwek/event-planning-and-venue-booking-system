# H3-T11 — Changing a venue's buffers flags a pending request that now overlaps a booking, and tells its coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T11 |
| Test Scenario | Changing a venue's buffers flags a pending request that now overlaps a booking, and tells its coordinator |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. A confirmed booking of the venue on Wednesday 2 December 2026, 10:00–12:00 (L1, M1).<br>4. A second event, the N1 second event statement (`tests/N1/README.md`), assigned to the other coordinator, has a **pending** request for the same venue, 12:15–14:00 (L1). It is not approved. |
| Test Steps | 1. As Venue Staff, set the turnaround time to `30` minutes and save.<br>2. Sign in as the second event's coordinator and open the event's "Venue requests".<br>3. Open "Notifications".<br>4. Sign in as the first event's coordinator and open that event's "Venue requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Turnaround `30` |
| Expected Result | After saving, the editor lists "Request BKR-… (EVT-…) overlaps BKR-…" (the booking), and "Booking BKR-… (EVT-…) overlaps BKR-…" (the request). The request is still **Pending**, still 12:15–14:00, and shows "Requires reconfirmation" and "Overlaps BKR-… with the venue's new setup and turnaround time", naming the booking. Its coordinator has a notification: "… now needs 0 minutes of setup and 30 minutes of turnaround, so booking request BKR-… for EVT-… now overlaps BKR-…. The request requires reconfirmation. It has not been removed, released or moved." The booking is still Confirmed, 10:00–12:00, shows "Requires reconfirmation" and names the request it overlaps, and its coordinator is told the same way. |
| Created By | Sahanya, via Claude |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Ran in the browser on CI's throwaway stack, with the cards' Wednesday 2 December 2026 moved to Tuesday 2 March 2027 (as the other venue journeys do) and unique names. A confirmed booking 10:00–12:00 for FX-BOOKING's event (Coordinator One) and a pending request 12:15–14:00 for the N1 second event (Coordinator Two) were made through L1 and M1. Venue Staff set the turnaround to 30 in the venue editor and saved: it read "Venue saved. With the new setup and turnaround time, these now overlap and require reconfirmation:" with the items "Booking BKR-… (EVT-…) overlaps BKR-…" (naming the request) and "Request BKR-… (EVT-…) overlaps BKR-…" (naming the booking), and "Their coordinators have been told. Nothing was removed, released or moved.". The change's two venue-booking.buffer-conflict-flagged messages were delivered by the test harness in place of Kafka and each was stored as one notification. Coordinator Two's Venue requests showed the request still Pending, still "Tuesday 2 March 2027, 12:15–14:00", with "Requires reconfirmation" and "Overlaps BKR-… with the venue's new setup and turnaround time" naming the booking, and Notifications read "<venue> now needs 0 minutes of setup and 30 minutes of turnaround, so booking request BKR-… for EVT-… “Faculty Awards Night …” now overlaps BKR-…. The request requires reconfirmation. It has not been removed, released or moved.". Coordinator One's Venue requests showed the booking still Confirmed, still 10:00–12:00, with "Requires reconfirmation" and "Overlaps BKR-… with the venue's new setup and turnaround time" naming the request, and the same notice for the booking ("so booking BKR-… … The booking requires reconfirmation. …"). Read back through the API, the request was PENDING 12:15–14:00 and the booking CONFIRMED 10:00–12:00, both flagged. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/h-venues.spec.ts › H3-T11 a longer turnaround flags a pending request and the booking it now overlaps, keeps both, and tells both coordinators, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
