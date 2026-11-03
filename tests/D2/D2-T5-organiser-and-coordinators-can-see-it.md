# D2-T5 — The clarification is visible to the owning organiser and to the assigned Event Coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T5 |
| Test Scenario | The clarification is visible to the owning organiser and to the assigned Event Coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed (assigned to `coordinator@connectsphere.test`); note the request id; sign out. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`, click "My requests", then "View" on the request.<br>2. Sign out, sign in as `coordinator@connectsphere.test` (the assigned coordinator), and go to http://localhost:5173/#/review/<id>.<br>3. Sign out, sign in as `coordinator2@connectsphere.test`, and go to the same address. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator@connectsphere.test`, `coordinator2@connectsphere.test` — all `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "Coordinator asked" shows "Please confirm the expected attendance." with "Awaiting your response". In step 2 the same message appears under "Clarifications". In step 3 the page shows "No event with that reference is assigned to you." and no clarification text. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

> **Revised for A4 (CR-05) on 3 Nov 2026.** Only the assigned coordinator sees the clarification; another coordinator gets the not-assigned refusal.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-03; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
