# L5-T3 — The replacement search (J1) starts from the event's requirements and the disrupted booking's period, and leaves out venues unavailable for that period

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T3 |
| Test Scenario | The replacement search (J1) starts from the event's requirements and the disrupted booking's period, and leaves out venues unavailable for that period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. The event needs 150 attending, Theatre layout.<br>3. Signed in as the assigned coordinator, on the event's "Venue requests". |
| Test Steps | 1. Click "Find a replacement" on the disrupted booking.<br>2. Read the search's filters and the venues listed. |
| Test Data | Account: the assigned coordinator |
| Expected Result | "Find a venue" opens saying it is finding a replacement for the booking, with From 2 December 2026 14:00, To 2 December 2026 18:00, minimum capacity 150 and layout Theatre. `Mochtar Riady Hall` is listed with "Request this venue". `Lee Kong Chian Auditorium` isn't listed: it is unavailable for that period. |
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
