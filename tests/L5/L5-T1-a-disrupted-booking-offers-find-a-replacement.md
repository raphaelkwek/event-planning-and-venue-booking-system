# L5-T1 — A booking flagged Requires Reconfirmation by an unavailability block offers its event's assigned coordinator a "Find a replacement" action, naming what disrupted it

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T1 |
| Test Scenario | A booking flagged Requires Reconfirmation by an unavailability block offers its event's assigned coordinator a "Find a replacement" action, naming what disrupted it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-L5 completed (`tests/L5/README.md`): the event's booking at `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00, disrupted by a block from 16:00 to 19:00. Note the booking reference.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the event from "All events" and click "Venue requests".<br>2. Read the booking's row under "Bookings". |
| Test Data | Account: the assigned coordinator |
| Expected Result | The row shows the booking reference, `Lee Kong Chian Auditorium`, Wednesday 2 December 2026, 14:00–18:00, Confirmed and "Requires reconfirmation", with the unavailability that disrupts it (Maintenance, `Stage rigging inspection`, 16:00–19:00), and a "Find a replacement" button. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The booking's row read "BKR-001355Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Confirmed Requires reconfirmationUnavailable: Maintenance, “Stage rigging inspection”, Wednesday 2 December 2026, 16:00–19:00Find a replacement", with a "Find a replacement" button. |
| Status | Pass |
| Remarks | Commit: a97986f · Evidence: tests/L5/evidence/L5-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
