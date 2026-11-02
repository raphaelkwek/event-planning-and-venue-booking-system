# R1-T2 — CR-03: an event with two confirmed venues lists each venue, and its places remaining is the total of their layout capacities

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T2 |
| Test Scenario | CR-03: an event with two confirmed venues lists each venue, and its places remaining is the total of their layout capacities |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults, then FX-R-SECOND-VENUE with 2 seats.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events".<br>2. Find `R Test Symposium` and click "View event". |
| Test Data | Venue 1: `Lee Kong Chian Auditorium`, `School of Computing, Level 1`, Theatre, 3 seats · Venue 2: `Seminar Room 2-1`, `School of Computing, Level 2`, Classroom, 2 seats |
| Expected Result | Both venues are listed, each with its location: `Lee Kong Chian Auditorium — School of Computing, Level 1` and `Seminar Room 2-1 — School of Computing, Level 2`. Places remaining reads `5 places remaining` (3 + 2), not 3 or 2. |
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
