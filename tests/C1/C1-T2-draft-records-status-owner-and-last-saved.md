# C1-T2 — A saved draft records status Draft, its owner and a last-saved time

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T2 |
| Test Scenario | A saved draft records status Draft, its owner and a last-saved time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Untitled idea` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests".<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select status, owner_id, last_saved_at from event.events where name = 'Untitled idea';` |
| Expected Result | The row shows status "Draft" and a date and time under "Last saved". The query returns `DRAFT`, `00000000-0000-0000-0000-000000000001`, and a `last_saved_at` matching the time shown. |
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
