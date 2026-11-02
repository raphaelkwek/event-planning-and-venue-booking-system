# R2-T10 — Boundary: a registration one millisecond after closing is refused, naming the window, with nothing stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T10 |
| Test Scenario | Boundary: a registration one millisecond after closing is refused, naming the window, with nothing stored |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed at 2026-12-10T10:00:00.001Z. |
| Test Steps | 1. Register one millisecond after closing.<br>2. Count the attendee's registrations and the event's free seats. |
| Test Data | Closing `2026-12-10T10:00:00.000Z` |
| Expected Result | `422` `REGISTRATION_OUTSIDE_WINDOW`, with a message naming the opening and closing date and time. No registration is stored and the free seats are unchanged. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r2Cards.test.ts › R2-T10 refuses a registration a millisecond after closing, naming the window, storing nothing (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
