# T2-T19 — Both coordinators read a notification when the reassignment is accepted (E2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T19 |
| Test Scenario | Both coordinators read a notification when the reassignment is accepted (E2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed; then the nominee accepts it. |
| Test Steps | 1. Sign in as the nominee and click "Notifications".<br>2. Sign out; sign in as the outgoing coordinator and click "Notifications". |
| Test Data | Both seeded coordinators |
| Expected Result | The nominee's notification says they are now the request's coordinator. The outgoing coordinator's says the reassignment was accepted and they are no longer its coordinator. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The nominee saw "You are now the coordinator of EVT-004538 “Annual Research Symposium”. 10/4/2026, 4:41:55 PM UNREAD Open Mark as read"; the outgoing coordinator saw "Your reassignment of EVT-004538 “Annual Research Symposium” was accepted. You are no longer its coordinator. 10/4/2026, 4:41:55 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T19.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
