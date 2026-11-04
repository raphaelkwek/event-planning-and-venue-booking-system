# H3-T13 — Times that only touch again clear the request's flag

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T13 |
| Test Scenario | Times that only touch again clear the request's flag (boundary: exactly at) |
| Pre-conditions | 1. H3-T11 completed: the booking 10:00–12:00 and the pending request 12:15–14:00 are both flagged, with turnaround 30. |
| Test Steps | 1. As Venue Staff, set the turnaround time to `15` minutes and save. The booking is then occupied until 12:15, exactly when the request starts.<br>2. Sign in as the second event's coordinator and open the event's "Venue requests", then "Notifications".<br>3. Set the turnaround time to `16` and save. |
| Test Data | Turnaround `15`, then `16` |
| Expected Result | After step 1 the editor lists nothing as flagged. The request is still Pending, 12:15–14:00, and no longer shows "Requires reconfirmation" or "Overlaps"; the booking no longer does either. No new notification is sent. After step 3 (one minute over) both are flagged again, each naming the other, and each coordinator receives a new notification. |
| Created By | Sahanya, via Claude |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Ran in the browser on CI's throwaway stack (2 March 2027 in place of 2 December 2026, unique names), from H3-T11's state: turnaround 30 had flagged the booking 10:00–12:00 and the request 12:15–14:00, and both coordinators' notices had been delivered by the test harness in place of Kafka. Step 1: Venue Staff saved turnaround 15 and the editor read "Venue saved." with nothing listed as flagged; delivering the events' outbox again stored no notification. Step 2: Coordinator Two's Venue requests showed the request still Pending, "Tuesday 2 March 2027, 12:15–14:00", with no "Requires reconfirmation" and no "Overlaps"; Notifications held only H3-T11's notice about the venue's times; Coordinator One's booking showed neither either. Step 3: turnaround 16 saved and the editor listed "Booking BKR-… (EVT-…) overlaps BKR-…" and "Request BKR-… (EVT-…) overlaps BKR-…", each naming the other; one new notice per coordinator was delivered and stored. Both rows showed "Requires reconfirmation" and "Overlaps … with the venue's new setup and turnaround time" again, and each coordinator's Notifications showed the new "… now needs 0 minutes of setup and 16 minutes of turnaround, so booking request BKR-… / booking BKR-… … now overlaps BKR-…. …" above H3-T11's 30-minute one. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/h-venues.spec.ts › H3-T13 times that only touch clear the request's flag without a notice, and one minute more flags both again, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
