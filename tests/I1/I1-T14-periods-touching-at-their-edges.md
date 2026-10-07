# I1-T14 — Boundary: a free period starts exactly where an occupied period ends, and an occupied period ending at closing time leaves no free period behind it

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T14 |
| Test Scenario | Boundary: a free period starts exactly where an occupied period ends, and an occupied period ending at closing time leaves no free period behind it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-WORKSHOP>`.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 7 December 2026 to 12 December 2026.<br>3. Look at Monday and Saturday. |
| Test Data | Account: `coordinator@connectsphere.test` · The symposium's turnaround ends at 12:30 on Monday · The coding workshop runs Saturday 12 December 15:00–17:00 with no setup and 60 minutes' turnaround, so it is occupied until 18:00, Saturday's closing time |
| Expected Result | Monday has a free period starting at exactly `12:30`. Saturday's "Committed" list has `15:00–17:00` Confirmed and `17:00–18:00` Turnaround, both labelled `<REF-WORKSHOP>`, and no Setup row, because the setup time is zero. Saturday's only free period is `09:00–15:00`. No zero-length period such as `18:00–18:00` appears. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Monday had a free period starting at exactly 12:30 (12:30–13:45). Saturday listed 15:00–17:00 Confirmed EVT-006215 and 17:00–18:00 Turnaround EVT-006215 · occupied, with no Setup row, and its only free period was 09:00–15:00. No zero-length period appeared. |
| Status | Pass |
| Remarks | Commit: 4bb7070 · Evidence: tests/I1/evidence/I1-T14.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
