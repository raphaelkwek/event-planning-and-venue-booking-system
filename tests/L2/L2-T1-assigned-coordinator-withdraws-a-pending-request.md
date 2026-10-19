# L2-T1 — The assigned coordinator withdraws a pending request; it becomes Withdrawn with who and when, and the record is kept

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T1 |
| Test Scenario | The assigned coordinator withdraws a pending request; it becomes Withdrawn with who and when, and the record is kept |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium` with the event's times. Note its booking reference.<br>4. Signed in as the assigned coordinator, on the event's "Venue requests". |
| Test Steps | 1. Click "Withdraw" on the request.<br>2. In the dialog, click "Withdraw request".<br>3. In the SQL editor, read the request's status, who withdrew it and when. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) |
| Expected Result | The dialog names the booking reference before anything changes. Afterwards the request is still listed, with status Withdrawn and no "Withdraw" button. In the database the row still exists, with status `WITHDRAWN`, the assigned coordinator as the withdrawing user and a withdrawal time within the last minute. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog named BKR-001137. Afterwards the row read "BKR-001137Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150Withdrawn", with no "Withdraw" button. The row still exists: status WITHDRAWN, withdrawn by 00000000-0000-0000-0000-000000000002 at 2026-10-19T08:21:33.780Z. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/L2/evidence/L2-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
