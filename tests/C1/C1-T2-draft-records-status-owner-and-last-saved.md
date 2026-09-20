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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The row read "—Untitled ideaDraft9/20/2026, 3:25:49 PM——Open draft". The query returned status DRAFT, owner_id 00000000-0000-0000-0000-000000000001, last_saved_at Sun Sep 20 2026 15:25:49 GMT+0800 (Singapore Standard Time) — the time shown under "Last saved". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
