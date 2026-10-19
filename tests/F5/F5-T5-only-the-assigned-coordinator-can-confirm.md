# F5-T5 — Nobody but the assigned coordinator can confirm, and an unknown event is not revealed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T5 |
| Test Scenario | Nobody but the assigned coordinator can confirm, and an unknown event is not revealed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS). |
| Test Steps | 1. As C2, then ORG, VS, TS and ATT, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. As C1, send `POST /api/v1/events/<random uuid>/confirmation`.<br>3. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T5 '` and read the named `F5-T5 ` result. |
| Test Data | Actors C2 (Event Coordinator, not assigned), ORG, VS, TS, ATT. Unknown id: a fresh random UUID. |
| Expected Result | HTTP 403 `ROLE_NOT_AUTHORISED` for C2 ("Only the event's assigned coordinator can confirm its arrangements.") and for ORG, VS, TS and ATT. HTTP 404 `EVENT_NOT_FOUND` for the unknown id. Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
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
