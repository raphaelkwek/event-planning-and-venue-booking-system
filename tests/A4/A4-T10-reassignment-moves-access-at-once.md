# A4-T10 — When the Lead reassigns an event, the previous coordinator loses it at once and the new coordinator gains it

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T10 |
| Test Scenario | When the Lead reassigns an event, the previous coordinator loses it at once and the new coordinator gains it |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`.<br>3. As LEAD, E1 reassigned from C1 to C2 with `POST /api/v1/events/<E1>/reassignment` (E4). |
| Test Steps | 1. As C1, send `GET /api/v1/events`, `GET /api/v1/events/queue` and `GET /api/v1/events/<E1>`.<br>2. As C1, send `POST /api/v1/events/<E1>/approve`.<br>3. As C2, send `GET /api/v1/events`, `GET /api/v1/events/queue` and `GET /api/v1/events/<E1>`.<br>4. As C2, send `POST /api/v1/events/<E1>/approve`.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T10 '` and read the named `A4-T10 ` result. |
| Test Data | Actors LEAD, C1, C2. E1 (Under Review, C1's until the reassignment). |
| Expected Result | C1: E1 is in neither list; opening it and approving it each answer HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you.", and E1 stays Under Review. C2: E1 is in both lists, opens with its full content, and the approval succeeds (E1 becomes Approved). |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
