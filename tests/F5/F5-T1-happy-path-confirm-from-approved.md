# F5-T1 — The assigned coordinator confirms an Approved event whose booking is confirmed and whose equipment is reserved in full

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T1 |
| Test Scenario | The assigned coordinator confirms an Approved event whose booking is confirmed and whose equipment is reserved in full |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T1 '` and read the named `F5-T1 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 200; `event.status` is `SAFETY_REVIEW`, `previousStatus` `APPROVED`, `confirmedBy` C1's id, `confirmedAt` set. E1's status is `SAFETY_REVIEW`, not `CONFIRMED`. The latest history entry reads `APPROVED` → `SAFETY_REVIEW`, C1, `EVENT_COORDINATOR`, `CONFIRM_ARRANGEMENTS`, with a non-empty `occurred_at`. B1 is still `CONFIRMED` and L1's reservation still 5 of 5. |
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
