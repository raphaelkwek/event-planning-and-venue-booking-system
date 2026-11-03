# R2-T7 — Boundary: a registration exactly at the opening instant is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T7 |
| Test Scenario | Boundary: a registration exactly at the opening instant is accepted |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed: the event opens at 2026-12-01T01:00:00.000Z. |
| Test Steps | 1. Register at exactly 2026-12-01T01:00:00.000Z. |
| Test Data | Opening `2026-12-01T01:00:00.000Z` (Tuesday 1 December 2026, 09:00 Singapore time) |
| Expected Result | The registration is accepted (`201`, status `REGISTERED`). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the clock at exactly 2026-12-01T01:00:00.000Z, the registration was 201. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r2Cards.test.ts › R2-T7 accepts a registration exactly at the opening instant, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
