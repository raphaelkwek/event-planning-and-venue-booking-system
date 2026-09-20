# A2-T4 — An organiser following a direct link to a coordinator screen is sent to their own screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T4 |
| Test Scenario | An organiser following a direct link to a coordinator screen is sent to their own screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. In the address bar, go to http://localhost:5173/#/queue.<br>2. In the address bar, go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Both times "My requests" opens and the address bar ends in `#/requests`. No review queue rows, no clarification form, and no "Approve" or "Reject" button appear. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both addresses opened "My requests": /queue → /#/requests · /review/3a9912b6-02cc-4d3e-bfc5-7560f9be8706 → /#/requests. No queue rows, no clarification form, no Approve or Reject. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A2/evidence/A2-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
