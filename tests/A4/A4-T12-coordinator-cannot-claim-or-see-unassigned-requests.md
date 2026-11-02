# A4-T12 — A coordinator cannot see the unassigned queue or claim an unassigned request (W9-35)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T12 |
| Test Scenario | A coordinator cannot see the unassigned queue or claim an unassigned request (W9-35) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C1, send `GET /api/v1/assignments/unassigned`.<br>2. As C1, send `POST /api/v1/events/<E3>/assignment` with `{"coordinatorId":"<C1>"}`.<br>3. As C1, send `POST /api/v1/events/<E3>/approve`.<br>4. Read E3 and its assignments.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T12 '` and read the named `A4-T12 ` result. |
| Test Data | Actor C1. E3 (Submitted, unassigned). |
| Expected Result | Steps 1 and 2 answer HTTP 403 `ROLE_NOT_AUTHORISED` (only the Lead assigns). Step 3 answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you." E3 is still Submitted with no assignment, and is still in the Lead's unassigned queue. |
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
