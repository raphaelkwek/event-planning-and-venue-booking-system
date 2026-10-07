# I1-T9 — After a booking is rejected, withdrawn or released, the calendar shows the period as free when next loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T9 |
| Test Scenario | After a booking is rejected, withdrawn or released, the calendar shows the period as free when next loaded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-SYMPOSIUM>`.<br>3. Signed in as `coordinator@connectsphere.test`.<br>4. Monday 7 December 2026 shown, with `10:00–12:00` marked "Confirmed" (I1-T2). |
| Test Steps | 1. In the SQL editor, run the I1 release statement (`tests/I1/README.md`). It sets the symposium's slot to RELEASED, which is what a rejection (M2), a withdrawal or a release (L5) does to a slot.<br>2. Back in the app, click "Show" again. |
| Test Data | Account: `coordinator@connectsphere.test` · The symposium's slot, reference `I1-FX-SYMPOSIUM` |
| Expected Result | `<REF-SYMPOSIUM>` no longer appears on Monday, and neither do its Setup and Turnaround rows. Monday's free periods are now `08:00–13:45` and `16:45–22:00`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the release statement, "Show" listed nothing for EVT-006676, no Setup or Turnaround for it, and Monday's free periods were 08:00–13:45, 16:45–22:00. |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
