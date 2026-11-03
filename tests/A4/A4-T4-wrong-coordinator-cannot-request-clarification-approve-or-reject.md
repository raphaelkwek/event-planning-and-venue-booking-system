# A4-T4 — A coordinator not assigned to an event cannot ask for clarification, approve or reject it (D2, D4, D5)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T4 |
| Test Scenario | A coordinator not assigned to an event cannot ask for clarification, approve or reject it (D2, D4, D5) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send `POST /api/v1/events/<E1>/clarifications` with `{"message":"Please confirm the expected attendance."}`.<br>2. As C2, send `POST /api/v1/events/<E1>/approve`.<br>3. As C2, send `POST /api/v1/events/<E1>/reject` with `{"reason":"No suitable venue is available."}`.<br>4. Read E1, its history, its clarifications and the event outbox.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T4 '` and read the named `A4-T4 ` result. |
| Test Data | Actor C2. E1 (Under Review, assigned to C1). |
| Expected Result | Each request answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you." E1 is still Under Review with the same version and no decision; its history, clarifications and the event outbox read exactly as before. ORG receives no notification. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | All three answered 404 EVENT_NOT_FOUND "No event with that reference is assigned to you.". E1, its history, clarifications and every outbox were unchanged. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
