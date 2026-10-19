# F5-T4 — Every status other than Approved and Planning is refused, naming the current status and Safety Review

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T4 |
| Test Scenario | Every status other than Approved and Planning is refused, naming the current status and Safety Review |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), repeated once per status in Test Data, with E1's status set to that status. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body. Repeat for each status in Test Data.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T4 '` and read the named `F5-T4 ` result. |
| Test Data | Statuses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `AWAITING_CLARIFICATION`, `SAFETY_REVIEW`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`. |
| Expected Result | HTTP 409 `STATUS_TRANSITION_NOT_PERMITTED` for each, with the message "This event is <label> and cannot move to Safety Review." (e.g. "This event is Under Review and cannot move to Safety Review."). Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
