# L5-T4 — A replacement request (L1) is linked to the disrupted booking it replaces, and raising it changes nothing on the event

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T4 |
| Test Scenario | A replacement request (L1) is linked to the disrupted booking it replaces, and raising it changes nothing on the event |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. In the SQL editor, note the event's `status` and `version`.<br>3. Signed in as the assigned coordinator, on the replacement search from L5-T3. |
| Test Steps | 1. Click "Request this venue" on `Mochtar Riady Hall`.<br>2. Read the form, choose Room layout Theatre, then click "Submit request".<br>3. In the SQL editor, read the new request's `replaces_booking_id`, and the event's `status` and `version` again. |
| Test Data | Account: the assigned coordinator |
| Expected Result | The form says the request replaces the disrupted booking, with `Mochtar Riady Hall` and 2 December 2026, 14:00–18:00 chosen. The request is accepted, Pending, and the event's "Venue requests" shows it as replacing the booking. `replaces_booking_id` is the disrupted booking's id; the event's status and version are unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
