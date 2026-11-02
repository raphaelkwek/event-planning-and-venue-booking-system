# R2-T13 — D-01: when manual additions (R7) take attendees above capacity, places remaining is zero, never negative, and registration is refused for capacity until withdrawals bring the total below capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T13 |
| Test Scenario | D-01: when manual additions (R7) take attendees above capacity, places remaining is zero, never negative, and registration is refused for capacity until withdrawals bring the total below capacity |
| Pre-conditions | Needs R7 (manual addition above capacity), which is not built. The rule is in the registration service's domain, `placesRemaining`. |
| Test Steps | 1. With R7: an event of 2 seats, both taken, and one attendee added manually above capacity.<br>2. Open the event as an attendee and try to register.<br>3. One registered attendee withdraws; try again.<br>4. A second one withdraws; try again. |
| Test Data | Capacity 2 · 3 attendees (one over capacity) |
| Expected Result | Step 2: places remaining reads `Full` (0, not −1) and registration is refused for capacity. Step 3: still `Full`, refused (total is back to capacity, not below). Step 4: one place remaining and registration succeeds. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
