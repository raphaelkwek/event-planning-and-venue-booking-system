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
| Actual Result | Review page as the assigned coordinator: Approve change enabled with the flag on; disabled with the explanation with it off while Reject change still opens; enabled when the flags call fails. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: frontend/tests/featureFlags.test.tsx › EN-15-T7 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
