# R2-T13 — D-01: when manual additions (R7) take attendees above capacity, places remaining is zero, never negative, and registration is refused for capacity until withdrawals bring the total below capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T13 |
| Test Scenario | D-01: when manual additions (R7) take attendees above capacity, places remaining is zero, never negative, and registration is refused for capacity until withdrawals bring the total below capacity |
| Pre-conditions | Needs R7 (manual addition above capacity), which is built. The rule is in the registration service's domain, `placesRemaining`. |
| Test Steps | 1. With R7: an event of 2 seats, both taken, and one attendee added manually above capacity.<br>2. Open the event as an attendee and try to register.<br>3. One registered attendee withdraws; try again.<br>4. A second one withdraws; try again. |
| Test Data | Capacity 2 · 3 attendees (one over capacity) |
| Expected Result | Step 2: places remaining reads `Full` (0, not −1) and registration is refused for capacity. Step 3: still `Full`, refused (total is back to capacity, not below). Step 4: one place remaining and registration succeeds. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Capacity 2, both seats taken and a third attendee added manually above capacity. Step 2: the event reads placesRemaining 0 and isFull true (not −1), and a new attendee's registration is refused with REGISTRATION_FULL. Step 3, after one withdrawal: the list's totals read registered 2, withdrawn 1, placesRemaining 0, the addition now holds a seat, and the new attendee is still refused with REGISTRATION_FULL; no free seat is left unclaimed. Step 4, after the second withdrawal: placesRemaining 1, isFull false, and the new attendee's registration succeeds with 201. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7496e5a · Evidence: backend/services/registration/tests/api/r7Cards.test.ts › R7-T12 gives a freed seat to an addition over capacity first (R2-T13), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638473298 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
