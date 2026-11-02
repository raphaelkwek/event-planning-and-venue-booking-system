# R4-T4 — Negative: withdrawing a registration that is already Withdrawn, or Cancelled, is refused and changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T4 |
| Test Scenario | Negative: withdrawing a registration that is already Withdrawn, or Cancelled, is refused and changes nothing |
| Pre-conditions | Automated (CI), against the registration schema. |
| Test Steps | 1. Withdraw a registration.<br>2. Withdraw it again.<br>3. Withdraw a registration whose event was cancelled. |
| Test Data | One withdrawn and one cancelled registration |
| Expected Result | Steps 2 and 3 are `409` `REGISTRATION_NOT_ACTIVE`, naming the registration and its status (`… is Withdrawn …`, `… is Cancelled …`). The first withdrawal time is unchanged and no second withdrawal message is written; places remaining is unchanged. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r4Cards.test.ts › R4-T4 refuses to withdraw a registration that is already Withdrawn or Cancelled, changing nothing (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
