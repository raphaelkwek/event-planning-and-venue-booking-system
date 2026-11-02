# A4-T13 — Every read beneath an event not assigned to you returns no data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T13 |
| Test Scenario | Every read beneath an event not assigned to you returns no data |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send each of: `GET /api/v1/events/<E2>/status-history`, `GET /api/v1/events/<E1>/clarifications`, `GET /api/v1/booking-requests?eventId=<E2>`, `GET /api/v1/holds?eventId=<E2>`, `GET /api/v1/equipment/request-lines?eventId=<E2>`, `GET /api/v1/equipment/request-lines/<EL1>`.<br>2. Repeat step 1 as C1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T13 '` and read the named `A4-T13 ` result. |
| Test Data | Actors C2 (not assigned) and C1 (assigned). E1, E2, EL1. |
| Expected Result | As C2, every request answers HTTP 404 (`EVENT_NOT_FOUND`, or `EQUIPMENT_LINE_NOT_FOUND` for the line) with the message from `tests/A4/README.md`, and no body holds a name, reference, field value, request, hold or line of E1 or E2. As C1, every request answers 200 with the data. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | As C2 every read answered 404 with A4's message and no id of E1, E2, EL1, BR1 or H1 in the body. As C1 every read answered 200. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-11-02 |
