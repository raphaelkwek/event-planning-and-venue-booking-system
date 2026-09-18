# E1-T4 — A second active assignment is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T4 |
| Test Scenario | An event has at most one active assigned coordinator at any time; creating a second active assignment is refused and names the current assignee |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed, so the event already carries one active assignment. |
| Test Steps | 1. Using the API console (`tests/README.md`), sign in as an internal user.<br>2. Attempt to trigger a second assignment for the same event id (there is no exposed endpoint that inserts an `event.assignments` row directly — assignment happens once, inside submission). |
| Test Data | The event id from FX-SUBMITTED. |
| Expected Result | A second active assignment cannot be created through any exposed action: E1 only assigns once, at submission, and E2's accept path atomically closes the outgoing assignment in the same transaction as it opens the new one, so it never produces two active rows. The invariant itself — `assignments_one_active_per_event` (a partial unique index on `event.assignments (event_id) where is_active`) — is exercised by the automated integration tests in `backend/services/event/tests/api/reassignments.test.ts`, not by a UI action. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | No endpoint exists that lets a caller attempt to create a second active assignment directly; the only two code paths that write to `event.assignments` (submission, and E2's accept) are each internally guarded. |
| Status | Blocked |
| Remarks | Blocked: there is no user-reachable action to attempt the refused case against. Covered instead by the automated repo/API tests. Commit: · Evidence: · Defect: |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-09-18 |
