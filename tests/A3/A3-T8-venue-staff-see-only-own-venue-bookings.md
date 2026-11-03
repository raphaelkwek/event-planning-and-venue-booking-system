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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

> **Deferred 2026-09-20 to H1 (Sprint 2) and L1 (Sprint 3).** Nothing in this case can be split off
> and run now: venues, venue ownership and booking requests are all Venue Service records, and that
> service does not exist. Re-read this case when L1 lands.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Venue Staff Booking requests queue listed only the request for their own venue, with its reference, the event reference, venue, period, Theatre, `150 attending`, facilities and accessibility; the other venue's request, venue and event reference were absent, and no purpose, description or accessibility needs were shown. The event's name, which the card's Expected Result lists, is not on the screen: the row carries the event's reference only. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Fail |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › A3-T8 Venue Staff see booking requests and bookings for their own venues only (marked as an expected failure so CI stays green), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: The Venue Staff booking-request queue (frontend/src/screens/BookingRequestQueue.tsx) shows the event's reference but not its name, which the card's Expected Result says the detail shows; the rest of the Expected Result held. Not fixed here (no app changes in this PR). |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |