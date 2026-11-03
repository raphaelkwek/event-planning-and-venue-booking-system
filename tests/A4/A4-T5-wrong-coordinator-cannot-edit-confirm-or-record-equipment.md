# A4-T5 — A coordinator not assigned to an event cannot edit its details, confirm its arrangements or record equipment for it (G1, F5, O1)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T5 |
| Test Scenario | A coordinator not assigned to an event cannot edit its details, confirm its arrangements or record equipment for it (G1, F5, O1) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send `PATCH /api/v1/events/<E2>` with header `If-Match` set to E2's version and body `{"purpose":"Share faculty research across schools"}`.<br>2. As C2, send `POST /api/v1/events/<E2>/confirmation` with no body.<br>3. As C2, send `POST /api/v1/equipment/request-lines` with `{"eventId":"<E2>","lines":[{"equipmentTypeId":"<A4 Chairs>","quantity":2}]}`.<br>4. Read E2, its history, its equipment lines and the event outbox.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T5 '` and read the named `A4-T5 ` result. |
| Test Data | Actor C2. E2 (Approved, assigned to C1). Equipment type `A4 Chairs`. |
| Expected Result | Each request answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you." E2's purpose, version and status are unchanged, its history has no new entry, it still has only EL1, and the event outbox reads exactly as before. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | All three answered 404 EVENT_NOT_FOUND "No event with that reference is assigned to you.". E2, its history, its lines and every outbox were unchanged. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
