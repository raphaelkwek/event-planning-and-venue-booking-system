# G1-T3 — Details can be edited while the event is Planning, Safety Review or Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T3 |
| Test Scenario | Details can be edited while the event is Planning, Safety Review or Confirmed |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEEDED run three times, with `'PLANNING'`, `'SAFETY_REVIEW'` and `'CONFIRMED'`, each ending `now() + interval '30 days'`. Note the ids.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the Planning request from "My requests", click "Edit details", change Purpose to `Planning-stage purpose`, and click "Save details".<br>2. Repeat for the Safety Review request with Purpose `Safety-review-stage purpose`.<br>3. Repeat for the Confirmed request with Purpose `Confirmed-stage purpose`. |
| Test Data | Account: `organiser@connectsphere.test` · Statuses Planning, Safety Review and Confirmed |
| Expected Result | All three saves show "Details saved.", and each request shows its new purpose with its status unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

> **Safety Review, decided 11 Oct 2026.** CR-06 added Safety Review between Planning and Confirmed
> after G1 was written, so G1's criteria don't name it. The team decided details stay editable
> during it for the time being.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
