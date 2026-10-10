# G1-T4 — Boundary: details can't be edited just before approval (Under Review) or once the event is over (Completed)

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T4 |
| Test Scenario | Boundary: details can't be edited just before approval (Under Review) or once the event is over (Completed) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed. Note its id.<br>3. FX-SEEDED run with `'COMPLETED'` ending `now() - interval '1 day'`. Note its id.<br>4. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the Under Review request from "My requests" and look for "Edit details".<br>2. Open the Completed request and look for "Edit details".<br>3. Open the API console and send `PATCH /event/api/v1/events/<Under Review id>` with body `{"purpose": "Too early"}`.<br>4. In the SQL editor, read the purpose and the history count: `select purpose, (select count(*) from event.event_history h where h.event_id = e.id and h.entry_type = 'FIELD_CHANGE') from event.events e where id = '<Under Review id>';`. |
| Test Data | Account: `organiser@connectsphere.test` · Statuses Under Review and Completed |
| Expected Result | Neither page offers "Edit details". The API returns `409` with code `EVENT_NOT_EDITABLE`, and a message that details can be edited only while the event is Approved, Planning, Safety Review or Confirmed, and that it is Under Review. The purpose is still `Share faculty research`, with no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
