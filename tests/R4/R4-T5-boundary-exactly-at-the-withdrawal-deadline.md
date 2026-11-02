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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
