# R5-T2 — The assigned coordinator sees the same registration list as the owning organiser

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T2 |
| Test Scenario | The assigned coordinator sees the same registration list as the owning organiser |
| Pre-conditions | 1. R5-T1's pre-conditions 1–3.<br>2. Signed in as `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event). |
| Test Data | As R5-T1 |
| Expected Result | The same row and totals as R5-T1. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r5Cards.test.ts › R5-T2 shows the assigned coordinator the same list, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
