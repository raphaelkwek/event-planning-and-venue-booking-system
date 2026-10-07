# I1-T8 — After a pending request is approved, the calendar shows it as confirmed when next loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T8 |
| Test Scenario | After a pending request is approved, the calendar shows it as confirmed when next loaded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-ALUMNI>`.<br>3. Signed in as `coordinator@connectsphere.test`.<br>4. Monday 7 December 2026 shown, with `14:00–16:00` marked "Pending" (I1-T3). |
| Test Steps | 1. In the SQL editor, run the I1 approval statement (`tests/I1/README.md`). It does to the slot what M1's approval will do: HELD becomes CONFIRMED.<br>2. Back in the app, click "Show" again. |
| Test Data | Account: `coordinator@connectsphere.test` · The alumni night's slot, reference `I1-FX-ALUMNI` |
| Expected Result | The `14:00–16:00` row is now marked "Confirmed", still labelled `<REF-ALUMNI>`, with its `13:45–14:00` Setup and `16:00–16:45` Turnaround rows. No row is marked "Pending" on Monday. The free periods are unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the approval statement, "Show" gave "14:00–16:00 Confirmed EVT-006617", with its 13:45–14:00 Setup and 16:00–16:45 Turnaround rows. No row was Pending, and the free periods were unchanged (08:00–09:30, 12:30–13:45, 16:45–22:00). |
| Status | Pass |
| Remarks | Commit: af33eaf · Evidence: tests/I1/evidence/I1-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
