# D2-T5 — The clarification is visible to the owning organiser and to Event Coordinators

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T5 |
| Test Scenario | The clarification is visible to the owning organiser and to Event Coordinators |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request id; sign out. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`, click "My requests", then "View" on the request.<br>2. Sign out, sign in as `coordinator2@connectsphere.test`, and go to http://localhost:5173/#/review/<id>. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator2@connectsphere.test` — both `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "Coordinator asked" shows "Please confirm the expected attendance." with "Awaiting your response". In step 2 the same message appears under "Clarifications". |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The owning organiser saw "Coordinator asked … Please confirm the expected attendance." with "Awaiting your response", and the second coordinator saw the same message under "Clarifications". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T5.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
