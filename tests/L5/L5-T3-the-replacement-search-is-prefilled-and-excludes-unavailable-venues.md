# L5-T3 — The replacement search (J1) starts from the event's requirements and the disrupted booking's period, and leaves out venues unavailable for that period

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T3 |
| Test Scenario | The replacement search (J1) starts from the event's requirements and the disrupted booking's period, and leaves out venues unavailable for that period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. The event expects 150 attending and records no venue requirements.<br>3. Signed in as the assigned coordinator, on the event's "Venue requests". |
| Test Steps | 1. Click "Find a replacement" on the disrupted booking.<br>2. Read the search's filters and the venues listed. |
| Test Data | Account: the assigned coordinator |
| Expected Result | "Find a venue" opens saying it is finding a replacement for the booking, with From 2 December 2026 14:00 and To 2 December 2026 18:00 from the booking, and minimum capacity 150 from the event; no layout is set, as the event asks for none. `Mochtar Riady Hall` is listed with "Request this venue". `Lee Kong Chian Auditorium` isn't listed: it is unavailable for that period. |
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
