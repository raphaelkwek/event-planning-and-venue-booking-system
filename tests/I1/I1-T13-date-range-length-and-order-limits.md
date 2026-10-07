# I1-T13 — Boundary: a range of 31 days is shown, 32 days is refused, and an end before the start is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T13 |
| Test Scenario | Boundary: a range of 31 days is shown, 32 days is refused, and an end before the start is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 1 December 2026 to 31 December 2026 (31 days).<br>3. Show 1 December 2026 to 1 January 2027 (32 days).<br>4. Show 13 December 2026 to 7 December 2026. |
| Test Data | Account: `coordinator@connectsphere.test` · Ranges of 31 days, 32 days and a reversed range |
| Expected Result | Step 2 shows 31 days, 1 to 31 December 2026, with the FX-CALENDAR periods on 7 to 13 December. Step 3 shows no calendar and a refusal saying a range can be at most 31 days. Step 4 shows no calendar and a refusal saying the end date must not be before the start date. Each refusal is shown next to the dates. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 1–31 December showed 31 days, Tuesday 1 December 2026 to Thursday 31 December 2026, with the FX-CALENDAR periods. 1 December to 1 January showed no calendar and, under To, "A range can be at most 31 days; this one is 32.". 13 to 7 December showed no calendar and "The end date must not be before the start date.". |
| Status | Pass |
| Remarks | Commit: 4bb7070 · Evidence: tests/I1/evidence/I1-T13.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
