# E3-T3 — The Lead opens a request from the queue and sees its basic information, without claiming it for review

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T3 |
| Test Scenario | The Lead opens a request from the queue and sees its basic information, without claiming it for review |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed.<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open "Unassigned" and click the request's reference.<br>2. Read the page, then read the request's status in the SQL editor. |
| Test Data | The standard request |
| Expected Result | The page shows the request's reference, name, purpose, proposed date and time, expected attendance, organiser and submission time, and "Unassigned". Its status is still Submitted. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The page showed the reference, name, purpose, proposed time, attendance 150, Organiser One as organiser, and "Unassigned". The status is still SUBMITTED. |
| Status | Pass |
| Remarks | Commit: f17c393 · Evidence: tests/E3/evidence/E3-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
