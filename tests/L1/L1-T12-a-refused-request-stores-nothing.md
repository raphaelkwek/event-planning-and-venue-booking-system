# L1-T12 — A refused request creates no booking record and changes no venue availability

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T12 |
| Test Scenario | A refused request creates no booking record and changes no venue availability |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form. |
| Test Steps | 1. Choose `Lee Kong Chian Auditorium`, set End time `13:00` (before the start) and Expected attendance `0`, and click "Submit request".<br>2. Open the venue's availability for 2 December 2026.<br>3. In the SQL editor, count the event's booking requests. |
| Test Data | Account: the assigned coordinator |
| Expected Result | Step 1 shows, under End time, that the end must be after the start, and under Expected attendance, that it must be a whole number greater than zero; no reference is shown. The calendar shows 2 December 2026 with nothing committed between 08:00 and 22:00. The event has no booking requests. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Under End time: "The end must be after the start."; under Expected attendance: "Expected attendance must be a whole number greater than zero."; no reference. The calendar's Committed list for Wednesday 2 December 2026 was 00:00–08:00 Outside operating hours; 22:00–24:00 Outside operating hours. The event had no booking requests. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T12.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
