# F1-T2 — No screen offers a way to set an event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T2 |
| Test Scenario | No screen offers a way to set an event's status |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id**. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`. Open the request from "My requests".<br>2. Sign out, sign in as `coordinator@connectsphere.test`, and open the same request.<br>3. On each screen, look for any control — dropdown, text field, button — that changes the status to a value of the user's choosing. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator@connectsphere.test` — both `ConnectSphere-Test-1234!` |
| Expected Result | Both screens show the status "Approved" as a read-only lozenge. Neither screen has a control that sets a status of the user's choosing. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
