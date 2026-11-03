# R4-T12 — The owning organiser sees the updated totals after a withdrawal (R5)

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T12 |
| Test Scenario | The owning organiser sees the updated totals after a withdrawal (R5) |
| Pre-conditions | Needs R5 (the organiser's registration list), which is built. The withdrawal itself is R4-T1. |
| Test Steps | 1. With R5: as the organiser, open the event's registrations before and after R4-T1. |
| Test Data | The withdrawal from R4-T1 |
| Expected Result | The withdrawn attendee's row shows `Withdrawn`, the registered total falls by one, the withdrawn total rises by one, and places remaining rises by one. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Before the withdrawal the organiser's list totals read registered 1, withdrawn 0, placesRemaining 2. After the attendee withdrew (200), they read registered 0, withdrawn 1, placesRemaining 3, and the attendee's row reads WITHDRAWN with the registration time and the withdrawal time. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7496e5a · Evidence: backend/services/registration/tests/api/r5Cards.test.ts › R5-T5 shows a withdrawal in the row and the totals on the next load (R4-T12), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638473298 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
