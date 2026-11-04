# H3-T12 — Requests that already clashed before the change aren't flagged by it

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T12 |
| Test Scenario | Requests that already clashed before the change aren't flagged by it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. Two events, FX-BOOKING's and the N1 second event statement's, each have a **pending** request for the venue on Wednesday 2 December 2026, 10:00–12:00 (L1). Both show "Conflict" in the Venue Staff "Booking requests" queue (N2). |
| Test Steps | 1. As Venue Staff, set the setup time to `15` minutes and save.<br>2. Open "Booking requests".<br>3. Sign in as each event's coordinator and open "Notifications". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Setup `15` |
| Expected Result | The editor reads "Venue saved." and lists nothing as flagged. Both requests are still Pending and still show "Conflict", naming each other (N2), and neither shows "Requires reconfirmation". Neither coordinator has a new notification. Their periods overlapped before the change, so the change made no new overlap: deciding between them is N2's, not H3's. |
| Created By | Sahanya, via Claude |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Ran in the browser on CI's throwaway stack (2 March 2027 in place of 2 December 2026, unique names). FX-BOOKING's event (Coordinator One) and the N1 second event (assigned to Coordinator Two, so that each request has its own coordinator) each had a pending request for 10:00–12:00, and before the change Venue Staff's Booking requests showed each with "Conflicts with BKR-… (pending request), Tuesday 2 March 2027, 10:00–12:00" naming the other. Everything the set-up wrote was first delivered to the notification service by the test harness, in place of Kafka. Venue Staff set the setup time to 15 and saved: the editor read "Venue saved." and listed nothing as flagged. Booking requests still showed both with "Conflict", each naming the other, and neither with "Requires reconfirmation"; through the API both were PENDING, not requiring reconfirmation, overlapping nothing. Delivering the events' outbox again stored no new notification and found no buffer-conflict-flagged message, and neither coordinator's Notifications held any notice naming the venue. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/h-venues.spec.ts › H3-T12 requests that already clashed are not flagged by a change of setup time, and nobody is told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
