# I1-T5 — CR-01: each booking and hold is shown with its setup time before it and its turnaround time after it, as occupied periods distinct from the event

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T5 |
| Test Scenario | CR-01: each booking and hold is shown with its setup time before it and its turnaround time after it, as occupied periods distinct from the event |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-SYMPOSIUM>` and `<REF-ALUMNI>`.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 7 December 2026 to 7 December 2026.<br>3. Read Monday's "Committed" list from top to bottom. |
| Test Data | Account: `coordinator@connectsphere.test` · The symposium's booking keeps 30 minutes' setup and 30 minutes' turnaround · The alumni night's hold keeps 15 minutes' setup and 45 minutes' turnaround |
| Expected Result | Between the outside-hours rows, Monday's "Committed" list reads, in order: `09:30–10:00` Setup, `<REF-SYMPOSIUM>`; `10:00–12:00` Confirmed, `<REF-SYMPOSIUM>`; `12:00–12:30` Turnaround, `<REF-SYMPOSIUM>`; `13:45–14:00` Setup, `<REF-ALUMNI>`; `14:00–16:00` Pending, `<REF-ALUMNI>`; `16:00–16:45` Turnaround, `<REF-ALUMNI>`. The Setup and Turnaround rows are marked occupied and have a different marker from the event rows. No free period overlaps 09:30–12:30 or 13:45–16:45. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Between the outside-hours rows, Monday read: 09:30–10:00 Setup EVT-006105 · occupied; 10:00–12:00 Confirmed EVT-006105; 12:00–12:30 Turnaround EVT-006105 · occupied; 13:45–14:00 Setup EVT-006106 · occupied; 14:00–16:00 Pending EVT-006106; 16:00–16:45 Turnaround EVT-006106 · occupied. Setup and Turnaround markers were rgb(222, 235, 255); the Confirmed marker was rgb(255, 235, 230) and the Pending marker rgb(255, 250, 230). Free periods were 08:00–09:30, 12:30–13:45, 16:45–22:00. |
| Status | Pass |
| Remarks | Commit: 69e657d · Evidence: tests/I1/evidence/I1-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
