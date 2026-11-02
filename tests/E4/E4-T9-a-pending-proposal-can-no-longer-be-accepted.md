# E4-T9 — A peer proposal still pending can no longer be accepted: accept answers 410 and the event keeps its coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T9 |
| Test Scenario | Coordinator-to-coordinator reassignment (E2) is retired (W9-FX-5): the nominee of a proposal made before the retirement cannot accept it, so no event leaves its coordinator without the Lead; migration event/0020 closes every proposal still pending |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied except event/0020.<br>2. Event E1 (Planning) assigned to Coordinator One, and the FX-PROPOSAL statement of `tests/E4/README.md` applied: a PENDING proposal from Coordinator One to Coordinator Two. |
| Test Steps | 1. As Coordinator Two, send `POST /api/v1/events/<E1>/reassignment-proposals/accept`.<br>2. Read `event.assignments` for E1 and the proposal's status.<br>3. Apply `backend/services/planning-core/migrations/event/0020_close_pending_reassignment_proposals.sql`, then read the proposal again.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/event/api/reassignments.test.ts tests/event/api/auditFixes.test.ts -t 'M8'` and read the named results. |
| Test Data | Nominee Coordinator Two |
| Expected Result | Step 1 answers HTTP 410 `REASSIGNMENT_RETIRED`, "Coordinators no longer accept reassignment proposals: the Event Coordinator Lead reassigns events (E4).". Step 2 shows one assignment, Coordinator One's, still active, no `event.reassignment-accepted` message, and the proposal PENDING. Step 3 leaves the proposal CLOSED with `resolved_at` set, and a proposal already DECLINED unchanged; running it again changes nothing. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Expected results are checked by the PR reviewer** against E4's Week 9 criterion (W9-FX-5).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | |
| Executed By | |
| Date of Execution | |
