# D2-T8 — Several clarifications on one request are kept in order, not overwritten

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T8 |
| Test Scenario | Several clarifications on one request are kept in order, not overwritten |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id. The coordinator is on the review screen. |
| Test Steps | 1. Send the first question.<br>2. Sign out, sign in as `organiser@connectsphere.test`, open the request, enter the first answer under "Respond", and click "Send response".<br>3. Sign out, sign in as `coordinator@connectsphere.test`, open the request, and send the second question.<br>4. Read "Clarifications". |
| Test Data | Accounts: `coordinator@connectsphere.test`, `organiser@connectsphere.test` — both `ConnectSphere-Test-1234!`<br>First question: `First question` · First answer: `First answer` · Second question: `Second question` |
| Expected Result | "Clarifications" lists "First question" with the organiser's reply "First answer", then "Second question" below it. Neither question has replaced the other. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Clarifications" listed "First question" with the reply "First answer", then "Second question" below it; the stored rows are in the same order with neither overwritten. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T8.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
