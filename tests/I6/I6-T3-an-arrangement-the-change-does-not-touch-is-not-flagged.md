# I6-T3 — A booking the change doesn't make overlap anything is shown as before, unflagged

## Specification

| Item | Content |
|---|---|
| Test Case ID | I6-T3 |
| Test Scenario | A booking the change doesn't make overlap anything is shown as before, unflagged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-OVERLAP completed, with a third booking for `<EVT-1>` at `Lee Kong Chian Auditorium`, 2 December 2026 16:00–18:00, approved before the turnaround time was changed.<br>3. Signed in as the coordinator of `<EVT-1>`. |
| Test Steps | 1. Open the venue's availability and show 2 December 2026.<br>2. Read the 16:00–18:00 row. |
| Test Data | Booking 16:00–18:00, clear of the others with 30 minutes of turnaround |
| Expected Result | The row reads "16:00–18:00 Confirmed `<EVT-1>`", with no flag, in the confirmed booking's usual appearance; the two overlapping bookings are still flagged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
