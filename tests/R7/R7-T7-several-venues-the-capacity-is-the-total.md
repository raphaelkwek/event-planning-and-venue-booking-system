# R7-T7 — CQ-04: for an event with several venues, the capacity is the total of their layout capacities

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T7 |
| Test Scenario | CQ-04: for an event with several venues, the capacity is the total of their layout capacities |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 2, FX-R-SECOND-VENUE with `<SEATS>` 3, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 4.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–3. |
| Test Data | 2 + 3 seats, 4 taken |
| Expected Result | The dialog shows `Capacity 5` and `With this addition: 5 attendees`, with no over-capacity warning. Added, not over capacity; `Places remaining 0`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
