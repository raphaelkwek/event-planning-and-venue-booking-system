# I5-T5 — The calendar shows the venue unavailable from the block's start, with no end, labelled open-ended

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T5 |
| Test Scenario | The calendar shows the venue unavailable from the block's start, with no end, labelled open-ended |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Lee Kong Chian Auditorium` from Wednesday 9 December 2026 13:00 with no end, Maintenance, `Roof leak repair`.<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Open Venues, click "View" on `Lee Kong Chian Auditorium`, then "Availability".<br>2. Show 8 December to 11 December 2026 and read each day's committed and free periods. |
| Test Data | Block from 9 December 13:00, no end; operating hours 08:00–22:00 Monday to Friday |
| Expected Result | 8 December is unchanged: free 08:00–22:00. 9 December shows the block from 13:00 to the end of the day, labelled "open-ended", with free 08:00–13:00. 10 and 11 December are unavailable all day, each labelled open-ended, with no free periods. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 8 December was free 08:00–22:00. 9 December showed "00:00–08:00 Outside operating hours; 13:00–24:00 Maintenance Roof leak repair · open-ended; 22:00–24:00 Outside operating hours", free 08:00–13:00. 10 and 11 December showed "00:00–08:00 Outside operating hours; 00:00–24:00 Maintenance Roof leak repair · open-ended; 22:00–24:00 Outside operating hours" and "00:00–08:00 Outside operating hours; 00:00–24:00 Maintenance Roof leak repair · open-ended; 22:00–24:00 Outside operating hours", with no free periods. |
| Status | Pass |
| Remarks | Commit: 44bda64 · Evidence: tests/I5/evidence/I5-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
