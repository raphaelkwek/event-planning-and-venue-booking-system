# I1-T3 — A pending booking request is shown in a state visually distinct from a confirmed booking, and labelled pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T3 |
| Test Scenario | A pending booking request is shown in a state visually distinct from a confirmed booking, and labelled pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-SYMPOSIUM>` and `<REF-ALUMNI>`.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 7 December 2026 to 7 December 2026.<br>3. Compare the `14:00–16:00` row with the `10:00–12:00` row. |
| Test Data | Account: `coordinator@connectsphere.test` · Alumni Networking Night's held slot (pending request), Monday 7 December 2026 14:00–16:00 |
| Expected Result | The `14:00–16:00` row is marked "Pending" and labelled `<REF-ALUMNI>`. Its marker has a different colour from the "Confirmed" marker on the `10:00–12:00` row, so the two can be told apart without reading the words. No free period overlaps 14:00–16:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The 14:00–16:00 row read "Pending EVT-006098". Its marker's colour was rgb(255, 250, 230); the Confirmed marker on 10:00–12:00 was rgb(255, 235, 230). Free periods were 08:00–09:30, 12:30–13:45, 16:45–22:00, none overlapping 14:00–16:00. |
| Status | Pass |
| Remarks | Commit: 69e657d · Evidence: tests/I1/evidence/I1-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
