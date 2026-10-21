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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
