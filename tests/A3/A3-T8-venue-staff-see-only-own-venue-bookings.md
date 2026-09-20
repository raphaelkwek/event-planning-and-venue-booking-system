# A3-T8 — Venue Staff see booking requests and bookings for their own venues only

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T8 |
| Test Scenario | Venue Staff see booking requests and bookings for their own venues only |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Two venues, one managed by `venuestaff@connectsphere.test`.<br>3. A booking request against each venue. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `venuestaff@connectsphere.test`.<br>2. Open the booking requests list.<br>3. Open the booking request for their own venue. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Only the booking request for their own venue is listed. Its detail shows the event name, timing, expected attendance, layout and requirements, and not the full internal event record. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Deferred 2026-09-20 to H1 (Sprint 2) and L1 (Sprint 3).** Nothing in this case can be split off
> and run now: venues, venue ownership and booking requests are all Venue Service records, and that
> service does not exist. Re-read this case when L1 lands.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: the Venue service, venues and booking requests (H1 Sprint 2, L1 Sprint 3) do not exist, so there is nowhere to perform the steps. |
| Status | Not Executed |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — · Was recorded Blocked on 2026-09-20; re-recorded as Not Executed because the case depends on unbuilt future stories rather than on something broken. |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
