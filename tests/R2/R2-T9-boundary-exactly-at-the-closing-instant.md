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
| Actual Result | With the clock at exactly 2026-12-10T10:00:00.000Z, the registration was 201. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r2Cards.test.ts › R2-T9 accepts a registration exactly at the closing instant, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
