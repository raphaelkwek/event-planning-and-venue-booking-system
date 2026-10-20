# H3-T8 — An event's occupied period includes the venue's setup and turnaround time

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T8 |
| Test Scenario | An event's occupied period includes the venue's setup and turnaround time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup 30 and turnaround 45 minutes (H3-T1).<br>3. A booking of the venue for an event from 10:00 to 12:00 (L1, M1). |
| Test Steps | 1. Open the venue's availability calendar for that day (I1). |
| Test Data | Event 10:00–12:00 · Setup 30 · Turnaround 45 |
| Expected Result | The venue is shown as occupied from 09:30 to 12:45, the customer's own example. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The calendar's committed rows for Wednesday 2 December 2026: 00:00–08:00 Outside operating hours; 09:30–10:00 Setup EVT-011448 · occupied; 10:00–12:00 Confirmed EVT-011448; 12:00–12:45 Turnaround EVT-011448 · occupied; 22:00–24:00 Outside operating hours; free: 08:00–09:30, 12:45–22:00. The venue is occupied from 09:30 to 12:45. |
| Status | Pass |
| Remarks | Commit: 0eb3119 · Evidence: tests/H3/evidence/H3-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |
