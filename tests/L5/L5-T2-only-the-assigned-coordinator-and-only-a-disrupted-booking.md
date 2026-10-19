# L5-T2 — "Find a replacement" is offered only to the event's assigned coordinator, and only on a booking an unavailability block disrupts

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T2 |
| Test Scenario | "Find a replacement" is offered only to the event's assigned coordinator, and only on a booking an unavailability block disrupts |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed.<br>3. Another of the event's requests, for `Seminar Room 2-1`, Classroom, 9 December 2026 10:00–12:00, has been approved; no block touches it. |
| Test Steps | 1. As the assigned coordinator, open the event's "Venue requests" and read both bookings' rows.<br>2. Sign out, sign in as `organiser@connectsphere.test` (the event's owner), and open the same page. |
| Test Data | Accounts: the assigned coordinator, then `organiser@connectsphere.test` |
| Expected Result | The coordinator sees "Find a replacement" on the `Lee Kong Chian Auditorium` booking only; the `Seminar Room 2-1` booking is Confirmed with no flag and no action. The organiser sees both bookings, the flag and the disruption, and no "Find a replacement" anywhere. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
