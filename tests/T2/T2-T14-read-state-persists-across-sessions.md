# T2-T14 — Read state persists across sessions

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T14 |
| Test Scenario | Read state persists across sessions |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. T2-T11 completed (the approval notification marked read). |
| Test Steps | 1. Sign out.<br>2. Sign in as `organiser@connectsphere.test` again and click "Notifications". |
| Test Data | — |
| Expected Result | The approval notification is still read, the clarification request is still unread, and the navigation reads "Notifications (1)". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After signing out and in again, the approval was still read, the clarification request still unread, and the navigation read "Notifications (1)". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T14.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
