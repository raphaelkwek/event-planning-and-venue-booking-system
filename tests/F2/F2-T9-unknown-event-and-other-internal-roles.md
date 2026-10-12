# F2-T9 — An unknown event gives 404, and Venue Staff and Technical Support get no history

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T9 |
| Test Scenario | An unknown event gives 404, and Venue Staff and Technical Support get no history |
| Pre-conditions | 1. FX-APPROVED completed; note the event id.<br>2. Signed in as `coordinator@connectsphere.test`, then as `venuestaff@connectsphere.test`. |
| Test Steps | 1. As the coordinator send `GET /event/api/v1/events/00000000-0000-0000-0000-000000000000/status-history`.<br>2. Sign in as Venue Staff and send `GET /event/api/v1/events/<id>/status-history`. |
| Test Data | Event: FX-APPROVED |
| Expected Result | Step 1: `404` `EVENT_NOT_FOUND`. Step 2: `403` `ROLE_NOT_AUTHORISED`, no history. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | As a coordinator, an unknown event id answered 404 EVENT_NOT_FOUND on both routes; as Venue Staff and as Technical Support, the history answered 403 ROLE_NOT_AUTHORISED. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 00ae997 · Evidence: backend/services/planning-core/tests/event/api/f2StatusAndHistory.test.ts › answers 404 for an unknown or malformed id on /status-history; refuses the history to VENUE_STAFF, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38196125896 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
