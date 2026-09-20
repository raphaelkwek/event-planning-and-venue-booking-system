# D3-T2 — Respond with a message only

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T2 |
| Test Scenario | Respond with a message only |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; sign out.<br>3. Signed in as `organiser@connectsphere.test`, on the request page. |
| Test Steps | 1. Enter the reply under "Respond", leaving the attendance amendment empty.<br>2. Click "Send response". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Reply: `We now expect 200 people.` |
| Expected Result | "Organiser replied" shows "We now expect 200 people." with its time. The status shows "Under Review" and the "Respond" section is gone. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Organiser replied" showed "We now expect 200 people." at 9/20/2026, 3:28:00 PM, the status returned to "Under Review", and the "Respond" section is gone. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D3/evidence/D3-T2.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
