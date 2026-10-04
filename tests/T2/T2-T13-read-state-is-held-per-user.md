# T2-T13 — Read state is held per user

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T13 |
| Test Scenario | Read state is held per user |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed, then the nominee accepts the proposal, so both coordinators are notified. |
| Test Steps | 1. Sign in as the outgoing coordinator; click "Notifications" and "Mark all as read".<br>2. Sign out; sign in as the nominee; click "Notifications". |
| Test Data | Both seeded coordinators |
| Expected Result | The nominee's acceptance notification is still unread: marking the outgoing coordinator's read did not touch it. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
