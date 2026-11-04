# L4-T11 — Registration capacity takes every venue into account (R2, R7, CQ-04)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T11 |
| Test Scenario | Registration capacity takes every venue into account (R2, R7, CQ-04) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with confirmed bookings for its event at `Lee Kong Chian Auditorium` (Theatre, 300) and `Seminar Room 2-1` (Classroom, 60).<br>3. The event Confirmed with registration open (U1, R1). |
| Test Steps | 1. Register attendees until registration closes (R2).<br>2. Raise the capacity check R7 makes. |
| Test Data | Capacity 300 + 60 = 360 |
| Expected Result | Registration is limited by the total of the two layout capacities: the 360th registration succeeds and the 361st is refused, naming capacity as the cause and offering the waitlist (R2, R6). |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

> **Not executable yet.** Registration (R2, R7) isn't built. CQ-04 is answered: the capacity is the total of the venues' layout capacities (`documentation/clarifications.md`, W9-08).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Automated at API level against the registration service and its migrated schema, as R2-T3 is: the Confirmed event with registration open reached the service as its listing, and its two confirmed bookings as two venue-booking.request-approved messages handled by the seat builder, Lee Kong Chian Auditorium (Theatre, 300) and Seminar Room 2-1 (Classroom, 60). Places remaining was 360. 359 attendees registered through POST /api/v1/registrations, then the 360th took the last place (201, places remaining 0). The 361st was refused 409 REGISTRATION_FULL, "EVT-… “R Test Symposium” has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.", with waitlistOffered true; 360 registrations held 360 distinct seats and the 361st attendee had none, and that attendee then joined the waitlist (Waitlisted, position 1). R7's capacity check took the same total: adding one more attendee by hand was refused 409 REGISTRATION_OVER_CAPACITY_UNCONFIRMED with capacity 360, registered 360, total after 361. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c0f7183 · Evidence: `backend/services/registration/tests/api/l4Cards.test.ts` › registration capacity across an event's venues (L4, CQ-04) › L4-T11 limits registration to the total of both layout capacities: the 360th registers, the 361st is refused for capacity and offered the waitlist, and R7 counts the same 360, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
