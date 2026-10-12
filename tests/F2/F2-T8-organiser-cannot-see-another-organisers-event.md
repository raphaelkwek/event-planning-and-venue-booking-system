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
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
