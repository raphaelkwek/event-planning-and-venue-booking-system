# EN-15-T7 — The change-decision screen disables Approve when the flag is off

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T7 |
| Test Scenario | The change-decision screen disables Approve when the flag is off |
| Pre-conditions | 1. Frontend tests (npm run test:unit). |
| Test Steps | 1. Open the review page as the assigned coordinator with a pending change and the flag on: Approve is enabled.<br>2. Repeat with the flag off.<br>3. Repeat when the flags endpoint fails. |
| Test Data | A pending change request; stubbed flags responses. |
| Expected Result | On: Approve change is enabled. Off: it is disabled with a message that approval is paused, and Reject change still opens. Endpoint failure: Approve stays enabled, because the server still enforces the flag. |
| Acceptance criterion | Frontend uses the flag to hide or disable approval. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
