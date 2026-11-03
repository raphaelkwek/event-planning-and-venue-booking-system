# R4-T5 — Boundary: a withdrawal exactly at the organiser's withdrawal deadline is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T5 |
| Test Scenario | Boundary: a withdrawal exactly at the organiser's withdrawal deadline is accepted |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed: deadline 2026-12-14T10:00:00.000Z. |
| Test Steps | 1. Withdraw at exactly the deadline. |
| Test Data | Deadline `2026-12-14T10:00:00.000Z` (Monday 14 December 2026, 18:00 Singapore time) |
| Expected Result | The withdrawal is accepted (`200`, status `WITHDRAWN`). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the clock at exactly 2026-12-14T10:00:00.000Z, the withdrawal was 200. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r4Cards.test.ts › R4-T5 allows a withdrawal exactly at the organiser's deadline, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
