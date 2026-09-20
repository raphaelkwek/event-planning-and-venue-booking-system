# D5-T2 — Reject with the reason left empty (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T2 |
| Test Scenario | Reject with the reason left empty (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Leave the reason empty.<br>3. Click "Reject request".<br>4. Click "Cancel". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: *(empty)* |
| Expected Result | In step 3 the dialog stays open and shows "A reason is required to reject an event request.". After step 4 the status is still "Under Review", no decision is shown, and "Approve" and "Reject" are enabled. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog stayed open showing "A reason is required to reject an event request.". After Cancel the status was still "Under Review" with no decision shown, and both buttons were enabled. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D5/evidence/D5-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
