# I1-T2 — A confirmed booking is shown as unavailable, labelled with its event reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T2 |
| Test Scenario | A confirmed booking is shown as unavailable, labelled with its event reference |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-SYMPOSIUM>`.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 7 December 2026 to 7 December 2026.<br>3. Look at Monday's "Committed" list. |
| Test Data | Account: `coordinator@connectsphere.test` · Annual Research Symposium's confirmed booking, Monday 7 December 2026 10:00–12:00 |
| Expected Result | Monday's "Committed" list has the row `10:00–12:00`, marked "Confirmed" and labelled `<REF-SYMPOSIUM>`. No free period on Monday overlaps 10:00–12:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
