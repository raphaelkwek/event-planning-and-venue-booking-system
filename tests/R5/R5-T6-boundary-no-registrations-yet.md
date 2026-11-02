# R5-T6 — Boundary: an event with no registrations shows an empty list, zero totals and every place remaining

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T6 |
| Test Scenario | Boundary: an event with no registrations shows an empty list, zero totals and every place remaining |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults (3 seats), then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event). |
| Test Data | 3 seats, no registrations |
| Expected Result | `No one has registered yet.` and `Registered 0`, `Withdrawn 0`, `Places remaining 3`, `Capacity 3`. |
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
