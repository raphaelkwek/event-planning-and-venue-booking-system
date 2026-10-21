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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
