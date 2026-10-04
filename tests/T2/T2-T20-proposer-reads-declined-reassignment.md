# T2-T20 — The proposing coordinator reads a notification when the reassignment is declined (E2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T20 |
| Test Scenario | The proposing coordinator reads a notification when the reassignment is declined (E2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed; then the nominee declines it. |
| Test Steps | 1. Sign in as the outgoing (proposing) coordinator.<br>2. Click "Notifications". |
| Test Data | The outgoing coordinator from FX-REASSIGNMENT-PENDING |
| Expected Result | A notification names the request and says the proposal was declined and they remain its coordinator. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | coordinator's list showed: "Your proposal to reassign EVT-004539 “Annual Research Symposium” was declined. You remain its coordinator. 10/4/2026, 4:42:02 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T20.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
