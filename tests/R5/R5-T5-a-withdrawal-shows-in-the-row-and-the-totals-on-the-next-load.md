# R5-T5 — A withdrawal is reflected in both the row status and the totals when the list is next loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T5 |
| Test Scenario | A withdrawal is reflected in both the row status and the totals when the list is next loaded |
| Pre-conditions | 1. R5-T1's pre-conditions 1–4, and the list open as in R5-T1. |
| Test Steps | 1. In another browser, as Attendee One, withdraw the registration (R4-T1 steps 1–3).<br>2. Reload the organiser's list. |
| Test Data | As R5-T1 |
| Expected Result | Before: `Registered 1`, `Withdrawn 0`, `Places remaining 2`. After: the row reads `Withdrawn` with its withdrawal time, and `Registered 0`, `Withdrawn 1`, `Places remaining 3`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r5Cards.test.ts › R5-T5 shows a withdrawal in the row and the totals on the next load (R4-T12), which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
