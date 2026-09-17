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
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Blocked |
| Remarks | Blocked: the Venue service (H1–N2) is not built, so there are no venues or booking requests. Identity already resolves the rule: `GET /identity/api/v1/access-scope/venue_bookings` returns `STAFF_OWNED_VENUES`. |
| Executed By | |
| Date of Execution | |
