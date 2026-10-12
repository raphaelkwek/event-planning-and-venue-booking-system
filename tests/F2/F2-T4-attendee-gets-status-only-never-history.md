# F2-T4 — An attendee is never given the history, review comments or rejection reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T4 |
| Test Scenario | An attendee is never given the history, review comments or rejection reason |
| Pre-conditions | 1. FX-REJECTED completed; note the event id.<br>2. Signed in as `attendee@connectsphere.test`. |
| Test Steps | 1. Open "API console" and send `GET /event/api/v1/events/<id>/status-history`.<br>2. Send `GET /event/api/v1/events/<id>/status`. |
| Test Data | Event: FX-REJECTED |
| Expected Result | Step 1: `403` with code `ROLE_NOT_AUTHORISED`; the body contains no history entry. Step 2: the attendee's scope contains no events until registration publishes them, so the answer is `404` `EVENT_NOT_FOUND` and carries no status, rejection reason or comment. Neither answer contains the words of the rejection reason. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | As an attendee on a rejected event with a recorded reason, the history request answered 403 ROLE_NOT_AUTHORISED and the status request answered 404 EVENT_NOT_FOUND; neither body contained the rejection reason or the status. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 00ae997 · Evidence: backend/services/planning-core/tests/event/api/f2StatusAndHistory.test.ts › never gives an attendee the history, and gives no event data at all outside their scope (AC3), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38196125896 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
