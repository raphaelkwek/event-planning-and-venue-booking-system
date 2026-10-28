# I5-T4 — From its start, an open-ended block refuses new booking requests and new holds for any later period, naming it as open-ended

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T4 |
| Test Scenario | From its start, an open-ended block refuses new booking requests and new holds for any later period, naming it as open-ended |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Lee Kong Chian Auditorium` from 2 December 2026 13:00 with no end, Maintenance, `Roof leak repair` (I5-T1).<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Request `Lee Kong Chian Auditorium`, Theatre, 150, 21 December 2026 14:00–18:00.<br>2. Request a hold at `Lee Kong Chian Auditorium`, 21 December 2026 14:00–18:00, reminder 60 minutes.<br>3. Request `Lee Kong Chian Auditorium`, Theatre, 150, 1 December 2026 10:00–12:00. |
| Test Data | Block from 2 December 13:00, no end |
| Expected Result | Steps 1 and 2 are refused, each message naming the Maintenance block, `Roof leak repair`, its start Wednesday 2 December 2026, 13:00 and that it is open-ended; nothing is stored. Step 3, before the block starts, is accepted. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Requesting 21 December was refused: "Lee Kong Chian Auditorium is unavailable for Maintenance, “Roof leak repair” (from Wednesday 2 December 2026, 13:00, open-ended), so it can't be requested for this period. Choose another time or venue.", storing nothing. A hold for 21 December was refused (409): "Lee Kong Chian Auditorium is unavailable for Maintenance, “Roof leak repair” (from Wednesday 2 December 2026, 13:00, open-ended), so a hold can't be requested for this period. Choose another time or venue.". Requesting 1 December 10:00–12:00, before the block, was accepted: BKR-003878 PENDING. |
| Status | Pass |
| Remarks | Commit: 44bda64 · Evidence: tests/I5/evidence/I5-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
