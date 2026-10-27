# E3-T2 — The unassigned queue lists each request's reference, name, proposed date, start and end time, expected attendance and submission time, oldest submission first, and only the Lead can see it

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T2 |
| Test Scenario | The unassigned queue lists each request's reference, name, proposed date, start and end time, expected attendance and submission time, oldest submission first, and only the Lead can see it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Two standard requests submitted as `organiser@connectsphere.test`, the second named `Alumni Networking Night`, a minute apart (FX-SUBMITTED twice). |
| Test Steps | 1. Sign in as `lead@connectsphere.test` and open "Unassigned".<br>2. Sign in as `coordinator@connectsphere.test`; look for "Unassigned" in the navigation, then open `#/assignments/unassigned`.<br>3. Repeat step 2 as `organiser@connectsphere.test`, `venuestaff@connectsphere.test` and `techsupport@connectsphere.test`. |
| Test Data | Two requests, submitted in order |
| Expected Result | The Lead's queue lists both, the first-submitted on top, each with its reference, name, proposed date, start and end time, expected attendance and submission time. No other account has "Unassigned" in its navigation, and opening the address shows them nothing from the queue (A2). |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Lead's queue listed EVT-014760 on row 1 and EVT-014761 on row 2: "EVT-014760Annual Research SymposiumWednesday 2 December 2026, 14:00–18:00150Tuesday 27 October 2026, 19:19". coordinator: no link, no queue, API 403; organiser: no link, no queue, API 403; venuestaff: no link, no queue, API 403; techsupport: no link, no queue, API 403. |
| Status | Pass |
| Remarks | Commit: f17c393 · Evidence: tests/E3/evidence/E3-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
