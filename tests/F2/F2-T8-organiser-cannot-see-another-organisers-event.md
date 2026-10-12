# F2-T8 — An organiser cannot read another organiser's event status or history

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T8 |
| Test Scenario | An organiser cannot read another organiser's event status or history |
| Pre-conditions | 1. FX-APPROVED completed by `organiser@connectsphere.test`; note the event id.<br>2. Signed in as `organiser2@connectsphere.test`. |
| Test Steps | 1. In "API console" send `GET /event/api/v1/events/<id>/status-history`.<br>2. Send `GET /event/api/v1/events/<id>/status`. |
| Test Data | Event: FX-APPROVED |
| Expected Result | Both answers are `404` with code `EVENT_NOT_FOUND`, with no status and no history entry: filtering applies when the event is read (A3). |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | As a second organiser, the status and status-history requests for the first organiser's event both answered 404 EVENT_NOT_FOUND with no status in the body. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 00ae997 · Evidence: backend/services/planning-core/tests/event/api/f2StatusAndHistory.test.ts › answers 404 and no data for another organiser's event (A3), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38196125896 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
