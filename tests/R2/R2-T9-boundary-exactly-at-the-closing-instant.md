# R2-T9 — Boundary: a registration exactly at the closing instant is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T9 |
| Test Scenario | Boundary: a registration exactly at the closing instant is accepted |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed: the event closes at 2026-12-10T10:00:00.000Z. |
| Test Steps | 1. Register at exactly 2026-12-10T10:00:00.000Z. |
| Test Data | Closing `2026-12-10T10:00:00.000Z` (Thursday 10 December 2026, 18:00 Singapore time) |
| Expected Result | The registration is accepted (`201`). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r2Cards.test.ts › R2-T9 accepts a registration exactly at the closing instant (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
