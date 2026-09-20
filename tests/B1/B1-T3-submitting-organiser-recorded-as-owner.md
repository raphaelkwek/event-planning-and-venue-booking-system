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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | EVT-001883 stored owner_id 00000000-0000-0000-0000-000000000001 and appeared in Organiser One’s My requests list. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B1/evidence/B1-T3-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |