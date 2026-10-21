# H3-T11 — Changing a venue's buffers flags a pending request that now overlaps a booking, and tells its coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T11 |
| Test Scenario | Changing a venue's buffers flags a pending request that now overlaps a booking, and tells its coordinator |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. A confirmed booking of the venue on Wednesday 2 December 2026, 10:00–12:00 (L1, M1).<br>4. A second event, the N1 second event statement (`tests/N1/README.md`), assigned to the other coordinator, has a **pending** request for the same venue, 12:15–14:00 (L1). It is not approved. |
| Test Steps | 1. As Venue Staff, set the turnaround time to `30` minutes and save.<br>2. Sign in as the second event's coordinator and open the event's "Venue requests".<br>3. Open "Notifications".<br>4. Sign in as the first event's coordinator and open that event's "Venue requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Turnaround `30` |
| Expected Result | After saving, the editor lists "Request BKR-… (EVT-…) overlaps BKR-…" (the booking), and "Booking BKR-… (EVT-…) overlaps BKR-…" (the request). The request is still **Pending**, still 12:15–14:00, and shows "Requires reconfirmation" and "Overlaps BKR-… with the venue's new setup and turnaround time", naming the booking. Its coordinator has a notification: "… now needs 0 minutes of setup and 30 minutes of turnaround, so request BKR-… for EVT-… now overlaps BKR-…. The request requires reconfirmation. It has not been removed, released or moved." The booking is still Confirmed, 10:00–12:00, shows "Requires reconfirmation" and names the request it overlaps, and its coordinator is told the same way. |
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
