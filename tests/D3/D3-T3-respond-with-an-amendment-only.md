# D3-T3 — Respond with an amendment only

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T3 |
| Test Scenario | Respond with an amendment only |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; sign out.<br>3. Signed in as `organiser@connectsphere.test`, on the request page. |
| Test Steps | 1. Leave the reply empty and enter the amendment.<br>2. Click "Send response". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Amend expected attendance: `200` |
| Expected Result | Expected attendance shows 200. "Organiser replied" reads "Amended the request without a message." The status shows "Under Review". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Expected attendance became 200, the thread read "Organiser replied — Amended the request without a message.", and the status returned to "Under Review". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D3/evidence/D3-T3.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
