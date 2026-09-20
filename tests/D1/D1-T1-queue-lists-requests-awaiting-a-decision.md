# D1-T1 — The queue lists every request awaiting a decision, and no decided ones

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T1 |
| Test Scenario | The queue lists every request awaiting a decision, and no decided ones |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED with Event name `Awaiting review`.<br>3. FX-UNDER-REVIEW with Event name `Being reviewed`.<br>4. FX-AWAITING with Event name `Waiting on organiser`.<br>5. FX-APPROVED with Event name `Already approved`.<br>6. FX-REJECTED with Event name `Already rejected`. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". Do not open any request. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Rows are listed for "Awaiting review" (Submitted), "Being reviewed" (Under Review) and "Waiting on organiser" (Awaiting Clarification). There is no row for "Already approved" or "Already rejected". |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The queue listed "Awaiting review" (Submitted), "Being reviewed" (Under Review) and "Waiting on organiser" (Awaiting Clarification), and neither decided request. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T1.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
