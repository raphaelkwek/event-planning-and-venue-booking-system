# F2-T7 — History cannot be edited or deleted from any screen or request

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T7 |
| Test Scenario | History cannot be edited or deleted from any screen or request |
| Pre-conditions | 1. FX-APPROVED completed; note the event id.<br>2. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the event and look over "Status history" for any edit, delete or add control.<br>2. In "API console" send `DELETE`, `PUT`, `PATCH` and `POST` to `/event/api/v1/events/<id>/status-history`.<br>3. Reload the event. |
| Test Data | Event: FX-APPROVED |
| Expected Result | Step 1: the section has no control that changes an entry. Step 2: each request is refused (`404`; no such route exists). Step 3: the same three entries are listed, unchanged. |
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
