# R4-T12 — The owning organiser sees the updated totals after a withdrawal (R5)

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T12 |
| Test Scenario | The owning organiser sees the updated totals after a withdrawal (R5) |
| Pre-conditions | Needs R5 (the organiser's registration list), which is not built. The withdrawal itself is R4-T1. |
| Test Steps | 1. With R5: as the organiser, open the event's registrations before and after R4-T1. |
| Test Data | The withdrawal from R4-T1 |
| Expected Result | The withdrawn attendee's row shows `Withdrawn`, the registered total falls by one, the withdrawn total rises by one, and places remaining rises by one. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | No longer blocked: R5 is built. Proven at API level by backend/services/registration/tests/api/r5Cards.test.ts › R5-T5 shows a withdrawal in the row and the totals on the next load (R4-T12), which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
