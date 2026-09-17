# B1-T3 — The submitting organiser is recorded as the owner

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T3 |
| Test Scenario | The submitting organiser is recorded as the owner |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data.<br>2. Sign in as `organiser@connectsphere.test` and click "My requests". |
| Test Data | Query: `select owner_id from event.events where reference = '<reference>';` |
| Expected Result | The query returns `00000000-0000-0000-0000-000000000001`, which is `organiser@connectsphere.test`. The request is listed in "My requests". |
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
