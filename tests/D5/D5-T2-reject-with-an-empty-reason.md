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
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
