# L1-T1 — The assigned coordinator requests a venue for an Approved event, and the request is stored Pending with its coordinator, time and a unique booking reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T1 |
| Test Scenario | The assigned coordinator requests a venue for an Approved event, and the request is stored Pending with its coordinator, time and a unique booking reference |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's reference and which coordinator is assigned.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the request from "All events" and click "Venue requests".<br>2. Click "Request a venue".<br>3. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Theatre`, leave the other fields as filled in, and click "Submit request". |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` · The standard request: 2 December 2026, 14:00–18:00, attendance 150 |
| Expected Result | The "Venue requests" screen shows "Booking request BKR-… submitted." and lists one request: its booking reference (`BKR-` and six digits), `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00, Theatre, 150, status Pending. In the SQL editor the request names the assigned coordinator as requester and a request time within the last minute. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Requested through the UI from All events: the notice, one Pending row with every field, and the requester and time read back through the API. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/l-bookings.spec.ts › L1-T1 the assigned coordinator requests a venue for an Approved event; it is stored Pending with a booking reference, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
