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
| Actual Result | The Status history section had no edit, delete or add control; from the API console DELETE, PUT, PATCH and POST to /event/api/v1/events/<id>/status-history each returned 404; after reloading, the same entries were listed and the stored history count was unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › F2-T7 history cannot be edited or deleted from any screen or request, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
