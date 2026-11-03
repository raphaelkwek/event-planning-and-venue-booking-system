# A4-T3 — Opening an event not assigned to you returns no event data, the same as an id that does not exist, and claims nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T3 |
| Test Scenario | Opening an event not assigned to you returns no event data, the same as an id that does not exist, and claims nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send `GET /api/v1/events/<E6>`.<br>2. As C2, send `GET /api/v1/events/<E3>`.<br>3. As C2, send `GET /api/v1/events/<E5>`.<br>4. As C2, send `GET /api/v1/events/<random uuid>`.<br>5. Read E6's status and assignment.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T3 '` and read the named `A4-T3 ` result. |
| Test Data | Actor C2. E6 (Submitted, C1's), E3 (unassigned), E5 (draft), and a fresh random UUID. |
| Expected Result | Each of steps 1 to 4 answers HTTP 404, code `EVENT_NOT_FOUND`, message "No event with that reference is assigned to you." The four bodies are identical: only `error`, with no name, reference, status or other event field. E6 is still Submitted and still assigned to C1: opening it did not start a review (D1) or claim it (W9-35). |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each of the four requests answered 404 EVENT_NOT_FOUND "No event with that reference is assigned to you." with only the error in the body. E6 stayed Submitted with no reviewer, assigned to C1; nothing else changed. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
