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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
